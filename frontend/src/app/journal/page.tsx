'use client'

import { useState, useEffect, useRef } from 'react'
import { Sidebar } from '@/components/Sidebar'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { Header } from '@/components/Header'
import { AccountSelector } from '@/components/AccountSelector'
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Plus,
  Filter,
  Download,
  TrendingUp,
  TrendingDown,
  Wallet,
  ChevronDown,
  Pencil
} from 'lucide-react'
import { formatCurrency, formatDateTime, cn, getLocalDateKey } from '@/lib/utils'
import { AddTradeModal, TradeFormData } from '@/components/AddTradeModal'
import { useAuth } from '@/contexts/AuthContext'
import { getTrades, createTrade, getAccounts, FirestoreAccount, calculateStats } from '@/lib/firebase/firestore'
import { Timestamp } from 'firebase/firestore'
import { Trade, useStore } from '@/lib/store'
import { TradeDetailsModal } from '@/components/TradeDetailsModal'
import { TagFilter } from '@/components/TagFilter'

function JournalContent() {
  const { user } = useAuth()
  const { isSidebarCollapsed, selectedTags, setSelectedTags } = useStore()
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [showAddTrade, setShowAddTrade] = useState(false)
  const [selectedTrade, setSelectedTrade] = useState<string | null>(null)
  const [editingTrade, setEditingTrade] = useState<Trade | null>(null)
  const [trades, setTrades] = useState<Trade[]>([])
  const [accounts, setAccounts] = useState<FirestoreAccount[]>([])
  const [selectedAccountId, setSelectedAccountId] = useState<string | 'all'>('all')
  const [showAccountDropdown, setShowAccountDropdown] = useState(false)
  const [loading, setLoading] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)

  // Load accounts
  useEffect(() => {
    const loadAccounts = async () => {
      if (user) {
        try {
          const userAccounts = await getAccounts(user.uid)
          setAccounts(userAccounts)
        } catch (error) {
          console.error('Error loading accounts:', error)
        }
      }
    }
    loadAccounts()
  }, [user])

  // Load trades from Firebase
  useEffect(() => {
    const loadTrades = async () => {
      if (user) {
        setLoading(true)
        try {
          const accountIdFilter = selectedAccountId === 'all' ? undefined : selectedAccountId
          const firestoreTrades = await getTrades(user.uid, { accountId: accountIdFilter })

          const convertedTrades: Trade[] = firestoreTrades.map(t => ({
            id: t.id || '',
            symbol: t.symbol,
            direction: t.direction,
            status: t.status,
            entryTime: t.entryTime?.toDate?.()?.toISOString() || new Date().toISOString(),
            exitTime: t.exitTime?.toDate?.()?.toISOString(),
            entryPrice: t.entryPrice,
            exitPrice: t.exitPrice,
            quantity: t.quantity,
            commission: t.commission,
            pnlNet: t.pnlNet,
            pnlPercent: t.pnlPercent,
            isWinner: t.pnlNet ? t.pnlNet > 0 : undefined,
            tags: t.tags || [],
            notes: t.notes,
          }))

          setTrades(convertedTrades)
        } catch (error) {
          console.error('Error loading trades:', error)
        } finally {
          setLoading(false)
        }
      }
    }
    loadTrades()
  }, [user, selectedAccountId, refreshKey])

  // Filter trades locally for the view
  const filteredTrades = selectedTags.length > 0
    ? trades.filter(t => selectedTags.every(tag => t.tags.includes(tag)))
    : trades

  // Group trades by date
  const tradesByDate = filteredTrades.reduce((acc, trade) => {
    const date = getLocalDateKey(trade.entryTime)
    if (!acc[date]) acc[date] = []
    acc[date].push(trade)
    return acc
  }, {} as Record<string, Trade[]>)

  const handleAddTrade = async (data: TradeFormData) => {
    if (!user || !selectedAccountId || selectedAccountId === 'all') {
      alert('אנא בחר תיק לפני הוספת עסקה')
      return
    }

    try {
      await createTrade(user.uid, selectedAccountId, {
        symbol: data.symbol,
        direction: data.direction,
        status: data.status,
        assetType: data.assetType || 'stock',
        entryTime: Timestamp.fromDate(new Date(data.entryTime)),
        exitTime: data.exitTime ? Timestamp.fromDate(new Date(data.exitTime)) : undefined,
        entryPrice: data.entryPrice,
        exitPrice: data.exitPrice,
        quantity: data.quantity,
        commission: data.commission || 0,
        tags: data.tags || [],
        notes: data.notes,
      })

      setRefreshKey(prev => prev + 1)
      setShowAddTrade(false)
    } catch (error) {
      console.error('Error adding trade:', error)
      alert('שגיאה בהוספת עסקה')
    }
  }

  const handleTradeUpdate = (updatedTrade: Trade) => {
    setRefreshKey(prev => prev + 1)
    setEditingTrade(null)
  }

  // Get current month dates
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear()
    const month = date.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const days = []

    // Add empty days for alignment
    for (let i = 0; i < firstDay.getDay(); i++) {
      days.push(null)
    }

    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push(new Date(year, month, i))
    }

    return days
  }

  const days = getDaysInMonth(selectedDate)
  const monthName = selectedDate.toLocaleString('default', { month: 'long', year: 'numeric' })

  const prevMonth = () => {
    setSelectedDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth() - 1, 1))
  }

  const nextMonth = () => {
    setSelectedDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 1))
  }

  const getDayPnL = (date: Date) => {
    const dateStr = getLocalDateKey(date)
    const dayTrades = tradesByDate[dateStr] || []
    return dayTrades.reduce((sum, t) => sum + (t.pnlNet || 0), 0)
  }

  const selectedAccount = selectedAccountId === 'all'
    ? null
    : accounts.find(a => a.id === selectedAccountId);

  return (
    <div className="flex min-h-screen">
      <Sidebar />

      <main className={cn(
        "flex-1 transition-all duration-300",
        isSidebarCollapsed ? "ml-28" : "ml-72"
      )}>
        <Header
          onAddTradeClick={() => setShowAddTrade(true)}
        />

        {/* Header */}
        <header className="sticky top-0 z-40 bg-dark-950/80 backdrop-blur-xl border-b border-dark-800/50">
          <div className="flex items-center justify-between px-6 py-4">
            <div>
              <h2 className="text-xl font-display font-bold text-white">Trade Journal</h2>
              <p className="text-sm text-dark-500">Review and analyze your trades by date</p>
            </div>
            <div className="flex items-center gap-3">
              {/* Account Selector */}
              <AccountSelector
                accounts={accounts}
                selectedAccountId={selectedAccountId}
                onChange={(id) => setSelectedAccountId(id)}
              />

              <div className="h-6 w-px bg-dark-800 mx-2" />
              <TagFilter
                availableTags={Array.from(new Set(trades.flatMap(t => t.tags)))}
                selectedTags={selectedTags}
                onChange={setSelectedTags}
              />

              <button className="btn-secondary flex items-center gap-2">
                <Filter className="w-4 h-4" />
                Filter
              </button>
              <button className="btn-secondary flex items-center gap-2">
                <Download className="w-4 h-4" />
                Export
              </button>
              <button onClick={() => setShowAddTrade(true)} className="btn-primary flex items-center gap-2">
                <Plus className="w-4 h-4" />
                Add Trade
              </button>
            </div>
          </div>
        </header>

        {loading ? (
          <div className="p-12 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <p className="text-dark-500 mt-4">טוען עסקאות...</p>
          </div>
        ) : (
          <div className="p-6 flex gap-6">
            {/* Calendar */}
            <div className="w-96 flex-shrink-0">
              <div className="chart-container">
                {/* Calendar Header */}
                <div className="flex items-center justify-between p-4 border-b border-dark-800/50">
                  <button onClick={prevMonth} className="p-2 hover:bg-dark-800 rounded-lg transition-colors">
                    <ChevronLeft className="w-5 h-5 text-dark-400" />
                  </button>
                  <h3 className="text-lg font-display font-semibold text-white">{monthName}</h3>
                  <button onClick={nextMonth} className="p-2 hover:bg-dark-800 rounded-lg transition-colors">
                    <ChevronRight className="w-5 h-5 text-dark-400" />
                  </button>
                </div>

                {/* Days of week */}
                <div className="grid grid-cols-7 gap-1 p-2">
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                    <div key={day} className="text-center text-xs text-dark-500 py-2">
                      {day}
                    </div>
                  ))}
                </div>

                {/* Calendar days */}
                <div className="grid grid-cols-7 gap-1 p-2">
                  {days.map((day, idx) => {
                    if (!day) return <div key={idx} />

                    const dateStr = getLocalDateKey(day)
                    const dayTrades = tradesByDate[dateStr] || []
                    const pnl = getDayPnL(day)
                    const isToday = day.toDateString() === new Date().toDateString()

                    return (
                      <button
                        key={idx}
                        onClick={() => setSelectedDate(day)}
                        className={cn(
                          'aspect-square p-1 rounded-lg text-sm transition-all',
                          'hover:bg-dark-800 flex flex-col items-center justify-center',
                          isToday && 'ring-2 ring-primary-500',
                          dayTrades.length > 0 && (
                            pnl >= 0 ? 'bg-profit/10' : 'bg-loss/10'
                          ),
                          dayTrades.length === 0 && 'bg-dark-900/50'
                        )}
                      >
                        <span className={cn(
                          'text-dark-300',
                          isToday && 'text-primary-400 font-bold'
                        )}>
                          {day.getDate()}
                        </span>
                        {dayTrades.length > 0 && (
                          <span className={cn(
                            'text-xs',
                            pnl >= 0 ? 'text-profit' : 'text-loss'
                          )}>
                            {dayTrades.length}T
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>

                {/* Legend */}
                <div className="p-4 border-t border-dark-800/50 flex justify-center gap-4 text-xs text-dark-500">
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded bg-profit/30" />
                    Profit
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded bg-loss/30" />
                    Loss
                  </div>
                </div>
              </div>
            </div>

            {/* Trade list for selected date */}
            <div className="flex-1">
              <div className="chart-container">
                <div className="p-4 border-b border-dark-800/50">
                  <h3 className="text-lg font-display font-semibold text-white">
                    {selectedDate.toLocaleDateString('en-US', {
                      weekday: 'long',
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric'
                    })}
                  </h3>
                  {(() => {
                    const dateStr = getLocalDateKey(selectedDate)
                    const dayTrades = tradesByDate[dateStr] || []
                    const pnl = dayTrades.reduce((sum, t) => sum + (t.pnlNet || 0), 0)
                    return (
                      <p className="text-sm text-dark-500">
                        {dayTrades.length} trades ·
                        <span className={pnl >= 0 ? 'text-profit' : 'text-loss'}>
                          {' '}{formatCurrency(pnl)}
                        </span>
                      </p>
                    )
                  })()}
                </div>

                <div className="divide-y divide-dark-800/50">
                  {(() => {
                    const dateStr = getLocalDateKey(selectedDate)
                    const dayTrades = tradesByDate[dateStr] || []

                    if (dayTrades.length === 0) {
                      return (
                        <div className="p-12 text-center text-dark-500">
                          <Calendar className="w-12 h-12 mx-auto mb-4 text-dark-600" />
                          <p>No trades on this day</p>
                          <button
                            onClick={() => setShowAddTrade(true)}
                            className="mt-4 btn-primary"
                          >
                            Add Trade
                          </button>
                        </div>
                      )
                    }

                    return dayTrades.map(trade => (
                      <div
                        key={trade.id}
                        onClick={() => setSelectedTrade(trade.id)}
                        className={cn(
                          'p-4 cursor-pointer transition-colors hover:bg-dark-800/50',
                          selectedTrade === trade.id && 'bg-dark-800/50'
                        )}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              'w-10 h-10 rounded-lg flex items-center justify-center',
                              trade.isWinner ? 'bg-profit/20' : 'bg-loss/20'
                            )}>
                              {trade.direction === 'long' ? (
                                <TrendingUp className={cn('w-5 h-5', trade.isWinner ? 'text-profit' : 'text-loss')} />
                              ) : (
                                <TrendingDown className={cn('w-5 h-5', trade.isWinner ? 'text-profit' : 'text-loss')} />
                              )}
                            </div>
                            <div>
                              <p className="font-bold text-white">{trade.symbol}</p>
                              <p className="text-xs text-dark-500">
                                {trade.direction.toUpperCase()} · {formatDateTime(trade.entryTime)}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-start gap-4">
                            <div className="text-right">
                              <p className={cn(
                                'font-bold',
                                trade.pnlNet && trade.pnlNet >= 0 ? 'text-profit' : 'text-loss'
                              )}>
                                {trade.pnlNet && trade.pnlNet >= 0 ? '+' : ''}
                                {formatCurrency(trade.pnlNet || 0)}
                              </p>
                              {trade.pnlPercent !== undefined && (
                                <p className={cn(
                                  'text-xs',
                                  trade.pnlPercent >= 0 ? 'text-profit/70' : 'text-loss/70'
                                )}>
                                  {trade.pnlPercent >= 0 ? '+' : ''}
                                  {trade.pnlPercent.toFixed(2)}%
                                </p>
                              )}
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                setEditingTrade(trade)
                              }}
                              className="p-1.5 hover:bg-dark-700/50 rounded-lg transition-colors text-dark-400 hover:text-white"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        {trade.notes && (
                          <p className="text-sm text-dark-400 mt-2 line-clamp-2">
                            {trade.notes}
                          </p>
                        )}

                        {trade.tags.length > 0 && (
                          <div className="flex gap-1 mt-2">
                            {trade.tags.map(tag => (
                              <span key={tag} className="tag tag-neutral">
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))
                  })()}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {editingTrade && (
        <TradeDetailsModal
          isOpen={!!editingTrade}
          onClose={() => setEditingTrade(null)}
          trade={editingTrade}
          onSave={handleTradeUpdate}
        />
      )}

      <AddTradeModal
        isOpen={showAddTrade}
        onClose={() => setShowAddTrade(false)}
        onSubmit={handleAddTrade}
      />
    </div>
  )
}

export default function JournalPage() {
  return (
    <ProtectedRoute>
      <JournalContent />
    </ProtectedRoute>
  )
}
