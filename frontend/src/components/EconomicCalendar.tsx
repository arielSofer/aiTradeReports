'use client'

import { useState, useEffect } from 'react'
import { 
  Calendar, 
  Clock, 
  Plus,
  Trash2,
  Globe,
  RefreshCw,
  Loader2,
  X
} from 'lucide-react'
import { cn, formatCurrency } from '@/lib/utils'
import { useAuth } from '@/contexts/AuthContext'
import { 
  collection, 
  addDoc, 
  getDocs, 
  deleteDoc, 
  doc, 
  query, 
  where,
  serverTimestamp,
  Timestamp
} from 'firebase/firestore'
import { db } from '@/lib/firebase/config'
import { fetchEconomicCalendarWithStatus } from '@/lib/economicCalendarApi'

// Impact levels
type Impact = 'high' | 'medium' | 'low'

// Asset categories
type AssetCategory = 'forex' | 'indices' | 'commodities' | 'crypto' | 'stocks'

interface EconomicEvent {
  id?: string
  userId?: string
  title: string
  description?: string
  date: string // ISO date string
  time: string // HH:MM format
  impact: Impact
  currency: string // e.g., USD, EUR, GBP
  category: AssetCategory
  actual?: string
  forecast?: string
  previous?: string
  isCustom?: boolean
  createdAt?: any
}

const impactColors = {
  high: { bg: 'bg-loss/20', text: 'text-loss', border: 'border-loss/50' },
  medium: { bg: 'bg-accent-orange/20', text: 'text-accent-orange', border: 'border-accent-orange/50' },
  low: { bg: 'bg-accent-blue/20', text: 'text-accent-blue', border: 'border-accent-blue/50' }
}

const categoryIcons: Record<AssetCategory, string> = {
  forex: '💱',
  indices: '📊',
  commodities: '🛢️',
  crypto: '₿',
  stocks: '📈'
}

const currencyFlags: Record<string, string> = {
  USD: '🇺🇸',
  EUR: '🇪🇺',
  GBP: '🇬🇧',
  JPY: '🇯🇵',
  AUD: '🇦🇺',
  CAD: '🇨🇦',
  CHF: '🇨🇭',
  NZD: '🇳🇿',
  CNY: '🇨🇳',
  BTC: '₿',
  ETH: 'Ξ'
}

// מטבעות זמינים לסינון
const CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF', 'NZD', 'CNY'] as const
type Currency = typeof CURRENCIES[number]

export function EconomicCalendar() {
  const { user } = useAuth()
  const [events, setEvents] = useState<EconomicEvent[]>([])
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [impactFilter, setImpactFilter] = useState<Impact | 'all'>('all')
  const [categoryFilter, setCategoryFilter] = useState<AssetCategory | 'all'>('all')
  const [currencyFilter, setCurrencyFilter] = useState<Currency | 'all'>('all')
  const [showAddModal, setShowAddModal] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [newEvent, setNewEvent] = useState<Partial<EconomicEvent>>({
    impact: 'medium',
    category: 'forex',
    currency: 'USD',
    date: new Date().toISOString().split('T')[0],
    time: '09:00'
  })
  const [apiError, setApiError] = useState<string | null>(null)
  const [needsCredits, setNeedsCredits] = useState(false)

  // Load events from API and Firebase
  useEffect(() => {
    loadEvents(false)
  }, [user])

  const loadEvents = async (forceRefresh = false) => {
    setIsLoading(true)
    setApiError(null)
    
    try {
      // Fetch from API (uses cache unless forceRefresh)
      const response = await fetchEconomicCalendarWithStatus(forceRefresh)
      
      if (response.error) {
        setApiError(response.error)
        setNeedsCredits(response.needsCredits || false)
      }
      
      const apiEvents = response.events || []
      
      // Also load custom events from Firebase if user is logged in
      let customEvents: EconomicEvent[] = []
      if (user) {
        const eventsRef = collection(db, 'economic_events')
        const q = query(eventsRef, where('userId', '==', user.uid))
        const snapshot = await getDocs(q)
        
        customEvents = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          isCustom: true
        })) as EconomicEvent[]
      }
      
      // Combine API events and custom events
      const allEvents = [...apiEvents, ...customEvents]
      
      // Sort by date and time
      allEvents.sort((a, b) => {
        const dateA = new Date(`${a.date} ${a.time}`)
        const dateB = new Date(`${b.date} ${b.time}`)
        return dateA.getTime() - dateB.getTime()
      })
      
      setEvents(allEvents)
    } catch (error) {
      console.error('Error loading events:', error)
      setApiError('Failed to load events')
      setEvents([])
    } finally {
      setIsLoading(false)
    }
  }

  const addEvent = async () => {
    if (!user || !newEvent.title || !newEvent.date || !newEvent.time) return
    
    try {
      const eventsRef = collection(db, 'economic_events')
      const eventData = {
        ...newEvent,
        userId: user.uid,
        createdAt: serverTimestamp()
      }
      
      const docRef = await addDoc(eventsRef, eventData)
      
      // Add to local state
      setEvents([...events, { 
        ...eventData, 
        id: docRef.id 
      } as EconomicEvent])
      
      setShowAddModal(false)
      setNewEvent({
        impact: 'medium',
        category: 'forex',
        currency: 'USD',
        date: new Date().toISOString().split('T')[0],
        time: '09:00'
      })
    } catch (error) {
      console.error('Error adding event:', error)
    }
  }

  const deleteEvent = async (eventId: string) => {
    if (!user) return
    
    try {
      await deleteDoc(doc(db, 'economic_events', eventId))
      setEvents(events.filter(e => e.id !== eventId))
    } catch (error) {
      console.error('Error deleting event:', error)
    }
  }

  // Filter events
  const filteredEvents = events.filter(event => {
    if (impactFilter !== 'all' && event.impact !== impactFilter) return false
    if (categoryFilter !== 'all' && event.category !== categoryFilter) return false
    if (currencyFilter !== 'all' && event.currency !== currencyFilter) return false
    return true
  })

  // Group events by date (filter out events without valid date)
  const eventsByDate = filteredEvents.reduce((acc, event) => {
    // Skip events without a valid date
    if (!event.date || event.date === 'undefined' || event.date === 'Invalid Date') {
      return acc
    }
    if (!acc[event.date]) acc[event.date] = []
    acc[event.date].push(event)
    return acc
  }, {} as Record<string, EconomicEvent[]>)

  // Sort dates
  const sortedDates = Object.keys(eventsByDate).sort()

  const formatEventDate = (dateStr: string) => {
    if (!dateStr || dateStr === 'undefined') {
      return 'Unknown Date'
    }
    
    try {
      const date = new Date(dateStr)
      if (isNaN(date.getTime())) {
        return dateStr // Return as-is if invalid
      }
      
      const today = new Date()
      const tomorrow = new Date(today)
      tomorrow.setDate(tomorrow.getDate() + 1)
      
      if (dateStr === today.toISOString().split('T')[0]) return 'Today'
      if (dateStr === tomorrow.toISOString().split('T')[0]) return 'Tomorrow'
      
      return date.toLocaleDateString('en-US', { 
        weekday: 'short', 
        month: 'short', 
        day: 'numeric' 
      })
    } catch {
      return dateStr
    }
  }

  return (
    <div className="chart-container">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-dark-800/50">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-accent-purple/20 rounded-lg">
            <Globe className="w-5 h-5 text-accent-purple" />
          </div>
          <div>
            <h3 className="text-lg font-display font-semibold text-white">Economic Calendar</h3>
            <p className="text-sm text-dark-500">Add your trading events & news</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={() => loadEvents(true)}
            disabled={isLoading}
            className="p-2 hover:bg-dark-800 rounded-lg transition-colors"
            title="Force refresh from API"
          >
            <RefreshCw className={cn(
              "w-4 h-4 text-dark-400",
              isLoading && "animate-spin"
            )} />
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="btn-primary flex items-center gap-2 text-sm"
          >
            <Plus className="w-4 h-4" />
            Add Event
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 p-4 border-b border-dark-800/50">
        {/* Impact Filter */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-dark-500">Impact:</span>
          <div className="flex gap-1">
            {(['all', 'high', 'medium', 'low'] as const).map(impact => (
              <button
                key={impact}
                onClick={() => setImpactFilter(impact)}
                className={cn(
                  'px-2 py-1 text-xs rounded transition-colors',
                  impactFilter === impact
                    ? impact === 'all' 
                      ? 'bg-primary text-white'
                      : `${impactColors[impact as Impact].bg} ${impactColors[impact as Impact].text}`
                    : 'bg-dark-800 text-dark-400 hover:bg-dark-700'
                )}
              >
                {impact === 'all' ? 'All' : impact.charAt(0).toUpperCase() + impact.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div className="h-6 w-px bg-dark-700" />

        {/* Currency Filter */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-dark-500">Currency:</span>
          <div className="flex gap-1 flex-wrap">
            <button
              onClick={() => setCurrencyFilter('all')}
              className={cn(
                'px-2 py-1 text-xs rounded transition-colors',
                currencyFilter === 'all'
                  ? 'bg-primary text-white'
                  : 'bg-dark-800 text-dark-400 hover:bg-dark-700'
              )}
            >
              All
            </button>
            {CURRENCIES.map(currency => (
              <button
                key={currency}
                onClick={() => setCurrencyFilter(currency)}
                className={cn(
                  'px-2 py-1 text-xs rounded transition-colors flex items-center gap-1',
                  currencyFilter === currency
                    ? 'bg-primary text-white'
                    : 'bg-dark-800 text-dark-400 hover:bg-dark-700'
                )}
              >
                <span>{currencyFlags[currency]}</span>
                <span>{currency}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="h-6 w-px bg-dark-700" />

        {/* Category Filter */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-dark-500">Asset:</span>
          <div className="flex gap-1">
            <button
              onClick={() => setCategoryFilter('all')}
              className={cn(
                'px-2 py-1 text-xs rounded transition-colors',
                categoryFilter === 'all'
                  ? 'bg-primary text-white'
                  : 'bg-dark-800 text-dark-400 hover:bg-dark-700'
              )}
            >
              All
            </button>
            {(Object.keys(categoryIcons) as AssetCategory[]).map(cat => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className={cn(
                  'px-2 py-1 text-xs rounded transition-colors',
                  categoryFilter === cat
                    ? 'bg-primary text-white'
                    : 'bg-dark-800 text-dark-400 hover:bg-dark-700'
                )}
              >
                {categoryIcons[cat]}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* API Error Banner */}
      {apiError && (
        <div className="mx-4 mt-4 p-4 bg-accent-orange/20 border border-accent-orange/50 rounded-lg">
          <p className="text-sm text-accent-orange">
            ⚠️ {needsCredits ? (
              <>
                Economic Calendar API requires credits. 
                <a 
                  href="https://www.jblanked.com/api/billing/" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="underline ml-1 hover:text-accent-orange/80"
                >
                  Add credits here
                </a>
              </>
            ) : apiError}
          </p>
          <p className="text-xs text-dark-500 mt-1">
            You can still add custom events manually.
          </p>
        </div>
      )}

      {/* Events List */}
      <div className="max-h-[500px] overflow-y-auto">
        {isLoading ? (
          <div className="p-12 text-center">
            <Loader2 className="w-8 h-8 text-primary-500 mx-auto mb-3 animate-spin" />
            <p className="text-dark-400">Loading economic events...</p>
          </div>
        ) : sortedDates.length === 0 ? (
          <div className="p-12 text-center">
            <Calendar className="w-12 h-12 text-dark-600 mx-auto mb-3" />
            <p className="text-dark-400">
              {apiError ? 'Add your own events below' : 'No events match your filters'}
            </p>
          </div>
        ) : (
          sortedDates.map(date => (
            <div key={date}>
              {/* Date Header */}
              <div className="sticky top-0 px-4 py-2 bg-dark-900/95 backdrop-blur-sm border-b border-dark-800/50">
                <span className="text-sm font-medium text-dark-300">
                  {formatEventDate(date)}
                </span>
              </div>

              {/* Events for this date */}
              <div className="divide-y divide-dark-800/30">
                {eventsByDate[date]
                  .sort((a, b) => a.time.localeCompare(b.time))
                  .map((event, idx) => (
                    <div
                      key={event.id || idx}
                      className="p-4 hover:bg-dark-800/30 transition-colors group"
                    >
                      <div className="flex items-start gap-3">
                        {/* Time & Impact */}
                        <div className="flex flex-col items-center gap-1 w-16 flex-shrink-0">
                          <span className="text-sm font-mono text-dark-300">{event.time}</span>
                          <div className={cn(
                            'px-2 py-0.5 rounded text-xs font-medium',
                            impactColors[event.impact].bg,
                            impactColors[event.impact].text
                          )}>
                            {event.impact === 'high' && '🔴'}
                            {event.impact === 'medium' && '🟠'}
                            {event.impact === 'low' && '🟡'}
                          </div>
                        </div>

                        {/* Event Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-lg">
                              {currencyFlags[event.currency] || '🌐'}
                            </span>
                            <span className="text-xs text-dark-500 font-mono">
                              {event.currency}
                            </span>
                            <span className="text-lg">
                              {categoryIcons[event.category]}
                            </span>
                            {event.isCustom && (
                              <span className="px-1.5 py-0.5 bg-accent-purple/20 text-accent-purple text-xs rounded">
                                Custom
                              </span>
                            )}
                          </div>
                          
                          <h4 className="font-medium text-white mb-1">{event.title}</h4>
                          
                          {event.description && (
                            <p className="text-sm text-dark-500 line-clamp-1">{event.description}</p>
                          )}

                          {/* Forecast/Previous/Actual */}
                          {(event.forecast || event.previous || event.actual) && (
                            <div className="flex gap-4 mt-2 text-xs">
                              {event.actual && (
                                <div>
                                  <span className="text-dark-500">Actual: </span>
                                  <span className="text-white font-medium">{event.actual}</span>
                                </div>
                              )}
                              {event.forecast && (
                                <div>
                                  <span className="text-dark-500">Forecast: </span>
                                  <span className="text-dark-300">{event.forecast}</span>
                                </div>
                              )}
                              {event.previous && (
                                <div>
                                  <span className="text-dark-500">Previous: </span>
                                  <span className="text-dark-400">{event.previous}</span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Actions */}
                        {event.isCustom && (
                          <button
                            onClick={() => event.id && deleteEvent(event.id)}
                            className="p-2 opacity-0 group-hover:opacity-100 hover:bg-dark-700 rounded transition-all"
                          >
                            <Trash2 className="w-4 h-4 text-loss" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-6 p-3 border-t border-dark-800/50 text-xs text-dark-500">
        <div className="flex items-center gap-2">
          <span className="text-loss">🔴</span>
          <span>High Impact</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-accent-orange">🟠</span>
          <span>Medium Impact</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-accent-blue">🟡</span>
          <span>Low Impact</span>
        </div>
      </div>

      {/* Add Event Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div 
            className="absolute inset-0 bg-black/60 backdrop-blur-sm" 
            onClick={() => setShowAddModal(false)} 
          />
          
          <div className="relative w-full max-w-lg bg-dark-900 rounded-2xl border border-dark-700 shadow-2xl">
            <div className="p-6 border-b border-dark-800">
              <h2 className="text-xl font-display font-bold text-white">Add Economic Event</h2>
              <p className="text-sm text-dark-500">Create a custom market event reminder</p>
            </div>

            <div className="p-6 space-y-4">
              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-dark-300 mb-2">Event Title *</label>
                <input
                  type="text"
                  value={newEvent.title || ''}
                  onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                  placeholder="e.g., FOMC Meeting"
                  className="input w-full"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-dark-300 mb-2">Description</label>
                <input
                  type="text"
                  value={newEvent.description || ''}
                  onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}
                  placeholder="Brief description..."
                  className="input w-full"
                />
              </div>

              {/* Date & Time */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-dark-300 mb-2">Date *</label>
                  <input
                    type="date"
                    value={newEvent.date || ''}
                    onChange={(e) => setNewEvent({ ...newEvent, date: e.target.value })}
                    className="input w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-dark-300 mb-2">Time *</label>
                  <input
                    type="time"
                    value={newEvent.time || ''}
                    onChange={(e) => setNewEvent({ ...newEvent, time: e.target.value })}
                    className="input w-full"
                  />
                </div>
              </div>

              {/* Impact & Category */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-dark-300 mb-2">Impact Level</label>
                  <select
                    value={newEvent.impact || 'medium'}
                    onChange={(e) => setNewEvent({ ...newEvent, impact: e.target.value as Impact })}
                    className="input w-full"
                  >
                    <option value="high">🔴 High</option>
                    <option value="medium">🟠 Medium</option>
                    <option value="low">🟡 Low</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-dark-300 mb-2">Category</label>
                  <select
                    value={newEvent.category || 'forex'}
                    onChange={(e) => setNewEvent({ ...newEvent, category: e.target.value as AssetCategory })}
                    className="input w-full"
                  >
                    <option value="forex">💱 Forex</option>
                    <option value="indices">📊 Indices</option>
                    <option value="commodities">🛢️ Commodities</option>
                    <option value="crypto">₿ Crypto</option>
                    <option value="stocks">📈 Stocks</option>
                  </select>
                </div>
              </div>

              {/* Currency */}
              <div>
                <label className="block text-sm font-medium text-dark-300 mb-2">Currency/Asset</label>
                <select
                  value={newEvent.currency || 'USD'}
                  onChange={(e) => setNewEvent({ ...newEvent, currency: e.target.value })}
                  className="input w-full"
                >
                  <option value="USD">🇺🇸 USD</option>
                  <option value="EUR">🇪🇺 EUR</option>
                  <option value="GBP">🇬🇧 GBP</option>
                  <option value="JPY">🇯🇵 JPY</option>
                  <option value="AUD">🇦🇺 AUD</option>
                  <option value="CAD">🇨🇦 CAD</option>
                  <option value="CHF">🇨🇭 CHF</option>
                  <option value="NZD">🇳🇿 NZD</option>
                  <option value="CNY">🇨🇳 CNY</option>
                  <option value="BTC">₿ BTC</option>
                  <option value="ETH">Ξ ETH</option>
                </select>
              </div>

              {/* Forecast/Previous */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-dark-300 mb-2">Forecast</label>
                  <input
                    type="text"
                    value={newEvent.forecast || ''}
                    onChange={(e) => setNewEvent({ ...newEvent, forecast: e.target.value })}
                    placeholder="e.g., 180K"
                    className="input w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-dark-300 mb-2">Previous</label>
                  <input
                    type="text"
                    value={newEvent.previous || ''}
                    onChange={(e) => setNewEvent({ ...newEvent, previous: e.target.value })}
                    placeholder="e.g., 175K"
                    className="input w-full"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 p-6 border-t border-dark-800">
              <button onClick={() => setShowAddModal(false)} className="btn-secondary">
                Cancel
              </button>
              <button 
                onClick={addEvent}
                disabled={!newEvent.title || !newEvent.date || !newEvent.time}
                className="btn-primary"
              >
                Add Event
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

