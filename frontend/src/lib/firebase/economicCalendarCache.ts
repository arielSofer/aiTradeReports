/**
 * Economic Calendar Cache
 * Stores calendar events in a single Firestore document
 * Refreshes once per day
 */

import {
  doc,
  getDoc,
  setDoc,
  Timestamp
} from 'firebase/firestore'
import { db } from './config'

export interface CachedEconomicEvent {
  id: string
  title: string
  date: string
  time: string
  currency: string
  impact: 'high' | 'medium' | 'low'
  category: string
  actual?: string
  forecast?: string
  previous?: string
  outcome?: string
  quality?: string
}

interface CacheDocument {
  lastUpdated: Timestamp
  source: string
  events: CachedEconomicEvent[]
}

const CACHE_DOC_PATH = 'system_cache/economic_calendar'

/**
 * Check if cache is still valid (less than 24 hours old)
 */
export async function isCacheValid(): Promise<boolean> {
  try {
    const cacheRef = doc(db, CACHE_DOC_PATH)
    const cacheSnap = await getDoc(cacheRef)

    if (!cacheSnap.exists()) {
      console.log('No cache exists')
      return false
    }

    const data = cacheSnap.data() as CacheDocument
    if (!data.lastUpdated) {
      return false
    }

    const lastUpdated = data.lastUpdated.toDate()
    const now = new Date()

    // Cache is valid for 6 hours
    const hoursDiff = (now.getTime() - lastUpdated.getTime()) / (1000 * 60 * 60)

    console.log(`Cache age: ${hoursDiff.toFixed(1)} hours, events: ${data.events?.length || 0}`)
    return hoursDiff < 6 && data.events && data.events.length > 0
  } catch (error) {
    console.error('Error checking cache validity:', error)
    return false
  }
}

/**
 * Get cached events from Firestore
 */
export async function getCachedEvents(): Promise<CachedEconomicEvent[]> {
  try {
    const cacheRef = doc(db, CACHE_DOC_PATH)
    const cacheSnap = await getDoc(cacheRef)

    if (!cacheSnap.exists()) {
      return []
    }

    const data = cacheSnap.data() as CacheDocument
    const events = data.events || []

    // Sort by date and time
    events.sort((a, b) => {
      const dateA = new Date(`${a.date} ${a.time}`)
      const dateB = new Date(`${b.date} ${b.time}`)
      return dateA.getTime() - dateB.getTime()
    })

    return events
  } catch (error) {
    console.error('Error getting cached events:', error)
    return []
  }
}

/**
 * Save events to Firestore cache
 */
export async function saveEventsToCache(
  events: CachedEconomicEvent[],
  source: string
): Promise<void> {
  try {
    // Limit to 500 events to stay within Firestore document size limit
    const eventsToSave = events.slice(0, 500)

    const cacheRef = doc(db, CACHE_DOC_PATH)
    await setDoc(cacheRef, {
      lastUpdated: Timestamp.now(),
      source,
      events: eventsToSave
    })

    console.log(`Cached ${eventsToSave.length} events to Firestore`)
  } catch (error) {
    console.error('Error saving to cache:', error)
    throw error
  }
}

/**
 * Get cache metadata
 */
export async function getCacheMetadata(): Promise<{ lastUpdated: Date; eventCount: number } | null> {
  try {
    const cacheRef = doc(db, CACHE_DOC_PATH)
    const cacheSnap = await getDoc(cacheRef)

    if (!cacheSnap.exists()) {
      return null
    }

    const data = cacheSnap.data() as CacheDocument
    return {
      lastUpdated: data.lastUpdated?.toDate() || new Date(),
      eventCount: data.events?.length || 0
    }
  } catch (error) {
    console.error('Error getting cache metadata:', error)
    return null
  }
}
