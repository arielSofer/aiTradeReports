/**
 * Economic Calendar API Service
 * Fetches events from JBlanked News API via our backend route
 * Uses Firestore cache - refreshes once per day
 * https://www.jblanked.com/news/api/docs/
 */

export interface EconomicEvent {
  id: string
  title: string
  description?: string
  date: string
  time: string
  impact: 'high' | 'medium' | 'low'
  currency: string
  category: 'forex' | 'indices' | 'commodities' | 'crypto' | 'stocks'
  actual?: string
  forecast?: string
  previous?: string
  country?: string
  outcome?: string
  quality?: string
}

export interface CalendarResponse {
  events: EconomicEvent[]
  source?: string // 'cache' | 'api' | 'cache-fallback'
  lastUpdated?: string
  eventCount?: number
  error?: string
  needsCredits?: boolean
}

/**
 * Fetch economic calendar events (uses cache by default)
 */
export async function fetchEconomicCalendar(forceRefresh = false): Promise<EconomicEvent[]> {
  try {
    const url = forceRefresh ? '/api/economic-calendar?refresh=true' : '/api/economic-calendar'
    const response = await fetch(url)
    
    if (!response.ok) {
      console.error('Failed to fetch economic calendar:', response.status)
      return []
    }
    
    const data: CalendarResponse = await response.json()
    
    console.log(`Economic calendar: ${data.eventCount || data.events?.length || 0} events from ${data.source || 'unknown'}`)
    
    if (data.error) {
      console.warn('Economic calendar warning:', data.error)
    }
    
    return data.events || []
  } catch (error) {
    console.error('Error fetching economic calendar:', error)
    return []
  }
}

/**
 * Force refresh calendar from API (ignores cache)
 */
export async function refreshEconomicCalendar(): Promise<EconomicEvent[]> {
  return fetchEconomicCalendar(true)
}

/**
 * Fetch economic calendar with full response including status info
 */
export async function fetchEconomicCalendarWithStatus(forceRefresh = false): Promise<CalendarResponse> {
  try {
    const url = forceRefresh ? '/api/economic-calendar?refresh=true' : '/api/economic-calendar'
    const response = await fetch(url)
    
    if (!response.ok) {
      console.error('Failed to fetch economic calendar:', response.status)
      return { events: [], error: `HTTP error: ${response.status}` }
    }
    
    const data: CalendarResponse = await response.json()
    return data
  } catch (error) {
    console.error('Error fetching economic calendar:', error)
    return { events: [], error: 'Failed to fetch calendar data' }
  }
}
