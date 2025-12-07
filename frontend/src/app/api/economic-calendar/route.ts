import { NextRequest, NextResponse } from 'next/server'

// Import cache functions dynamically to avoid SSR issues
let cacheModule: any = null

async function getCache() {
  if (!cacheModule) {
    cacheModule = await import('@/lib/firebase/economicCalendarCache')
  }
  return cacheModule
}

/**
 * API Route to fetch economic calendar
 * Uses Firestore cache - refreshes from JBlanked API once per day
 */

export async function GET(request: NextRequest) {
  const forceRefresh = request.nextUrl.searchParams.get('refresh') === 'true'
  
  try {
    const cache = await getCache()
    
    // Check if we have valid cached data
    if (!forceRefresh) {
      try {
        const isValid = await cache.isCacheValid()
        if (isValid) {
          console.log('Serving from cache')
          const cachedEvents = await cache.getCachedEvents()
          const metadata = await cache.getCacheMetadata()
          
          return NextResponse.json({ 
            events: cachedEvents, 
            source: 'cache',
            lastUpdated: metadata?.lastUpdated?.toISOString() || null,
            eventCount: cachedEvents.length
          })
        }
      } catch (cacheError) {
        console.error('Cache check failed:', cacheError)
        // Continue to fetch from API
      }
    }
    
    // Cache is expired or doesn't exist - fetch from API
    console.log('Cache expired or empty, fetching from API...')
    
    const apiKey = process.env.JBLANKED_API_KEY || process.env.NEXT_PUBLIC_JBLANKED_API_KEY
    
    if (!apiKey) {
      // No API key - try cache anyway
      console.log('No API key configured, trying cache...')
      try {
        const cachedEvents = await cache.getCachedEvents()
        if (cachedEvents.length > 0) {
          return NextResponse.json({ 
            events: cachedEvents, 
            source: 'cache-no-key',
            eventCount: cachedEvents.length
          })
        }
      } catch {}
      
      return NextResponse.json({ 
        events: [], 
        source: 'none',
        message: 'No API key configured'
      })
    }
    
    // Fetch from JBlanked API
    // Use /week/ endpoint for this week's events
    const url = 'https://www.jblanked.com/news/api/mql5/calendar/week/'
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Api-Key ${apiKey}`
      },
      cache: 'no-store'
    })

    if (!response.ok) {
      const text = await response.text()
      console.error('JBlanked API error:', response.status, text)
      
      // If API fails, try to return cached data anyway
      try {
        const cachedEvents = await cache.getCachedEvents()
        if (cachedEvents.length > 0) {
          return NextResponse.json({ 
            events: cachedEvents, 
            source: 'cache-fallback',
            error: `API error: ${response.status}`
          })
        }
      } catch {}
      
      return NextResponse.json({ 
        events: [], 
        error: `API error: ${response.status}`
      })
    }

    const data = await response.json()
    
    console.log(`Received ${Array.isArray(data) ? data.length : 0} events from JBlanked API`)
    
    // Transform the data to our format
    // Note: JBlanked API uses capitalized keys (Name, Currency, Event_ID, etc.)
    const events = Array.isArray(data) ? data
      .filter((event: any) => event && (event.Name || event.name || event.title))
      .map((event: any, index: number) => {
        const dateStr = event.Date || event.date || event.time || ''
        return {
          id: `jb-${event.Event_ID || event.event_id || event.id || index}`,
          title: event.Name || event.name || event.title || 'Unknown Event',
          date: formatDate(dateStr),
          time: formatTime(dateStr),
          currency: event.Currency || event.currency || 'USD',
          impact: mapImpact(event.Strength || event.strength || event.impact),
          category: mapCategory(event.Category || event.category),
          actual: event.Actual !== null && event.Actual !== undefined ? String(event.Actual) : 
                  event.actual !== null && event.actual !== undefined ? String(event.actual) : undefined,
          forecast: event.Forecast !== null && event.Forecast !== undefined ? String(event.Forecast) :
                    event.forecast !== null && event.forecast !== undefined ? String(event.forecast) : undefined,
          previous: event.Previous !== null && event.Previous !== undefined ? String(event.Previous) :
                    event.previous !== null && event.previous !== undefined ? String(event.previous) : undefined,
          outcome: event.Outcome || event.outcome,
          quality: event.Quality || event.quality
        }
      }) : []

    console.log(`Fetched ${events.length} events from API`)
    
    // Save to cache
    if (events.length > 0) {
      try {
        await cache.saveEventsToCache(events, 'jblanked')
        console.log('Events saved to cache')
      } catch (cacheError) {
        console.error('Failed to save to cache:', cacheError)
        // Continue anyway - we have the events
      }
    }
    
    return NextResponse.json({ 
      events, 
      source: 'api',
      eventCount: events.length
    })
  } catch (error) {
    console.error('Error in economic calendar API:', error)
    
    // Try to return cached data on error
    try {
      const cache = await getCache()
      const cachedEvents = await cache.getCachedEvents()
      if (cachedEvents.length > 0) {
        return NextResponse.json({ 
          events: cachedEvents, 
          source: 'cache-error-fallback'
        })
      }
    } catch {}
    
    return NextResponse.json({ events: [], error: 'Failed to fetch' })
  }
}

function formatDate(dateStr: string): string {
  if (!dateStr || dateStr === 'undefined' || dateStr === 'null') {
    return new Date().toISOString().split('T')[0]
  }
  
  try {
    if (dateStr.includes('.')) {
      const parts = dateStr.split(' ')[0].split('.')
      if (parts.length === 3 && parts[0] && parts[1] && parts[2]) {
        return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`
      }
    }
    
    if (dateStr.includes('T') || dateStr.includes('-')) {
      const date = new Date(dateStr)
      if (!isNaN(date.getTime())) {
        return date.toISOString().split('T')[0]
      }
    }
    
    const date = new Date(dateStr)
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0]
    }
    
    return new Date().toISOString().split('T')[0]
  } catch {
    return new Date().toISOString().split('T')[0]
  }
}

function formatTime(dateStr: string): string {
  if (!dateStr || dateStr === 'undefined' || dateStr === 'null') {
    return '00:00'
  }
  
  try {
    if (dateStr.includes(' ')) {
      const timePart = dateStr.split(' ')[1]
      if (timePart && timePart.length >= 5) {
        return timePart.slice(0, 5)
      }
    }
    
    if (dateStr.includes('T')) {
      const timePart = dateStr.split('T')[1]
      if (timePart && timePart.length >= 5) {
        return timePart.slice(0, 5)
      }
    }
    
    return '00:00'
  } catch {
    return '00:00'
  }
}

function mapImpact(strength: string): 'high' | 'medium' | 'low' {
  if (!strength) return 'medium'
  const s = strength.toLowerCase()
  if (s.includes('strong') || s.includes('high')) return 'high'
  if (s.includes('weak') || s.includes('low')) return 'low'
  return 'medium'
}

function mapCategory(category: string): string {
  if (!category) return 'forex'
  const c = category.toLowerCase()
  if (c.includes('oil') || c.includes('gold') || c.includes('commodity')) return 'commodities'
  if (c.includes('index') || c.includes('pmi')) return 'indices'
  if (c.includes('crypto') || c.includes('bitcoin')) return 'crypto'
  if (c.includes('stock') || c.includes('earning')) return 'stocks'
  return 'forex'
}
