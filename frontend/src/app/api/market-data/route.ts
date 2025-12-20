import { NextRequest, NextResponse } from 'next/server'

// Databento symbol mapping for CME Globex futures
// Dataset: GLBX.MDP3 (CME Globex MDP 3.0)
const DATABENTO_SYMBOL_MAP: Record<string, string> = {
    // Micro E-mini futures
    'MNQ': 'MNQ.c.0',  // Micro Nasdaq-100 continuous front month
    'MES': 'MES.c.0',  // Micro S&P 500
    'M2K': 'M2K.c.0',  // Micro Russell 2000
    'MYM': 'MYM.c.0',  // Micro Dow
    'MCL': 'MCL.c.0',  // Micro Crude Oil
    'MGC': 'MGC.c.0',  // Micro Gold

    // E-mini futures
    'NQ': 'NQ.c.0',    // E-mini Nasdaq
    'ES': 'ES.c.0',    // E-mini S&P 500
    'RTY': 'RTY.c.0',  // E-mini Russell
    'YM': 'YM.c.0',    // E-mini Dow

    // Commodities
    'GC': 'GC.c.0',    // Gold
    'CL': 'CL.c.0',    // Crude Oil
    'SI': 'SI.c.0',    // Silver
    'NG': 'NG.c.0',    // Natural Gas
}

// Convert interval to Databento OHLCV schema
// For 5m and 15m we fetch 1m data and aggregate
const DATABENTO_SCHEMA_MAP: Record<string, string> = {
    '1m': 'ohlcv-1m',
    '5m': 'ohlcv-1m',   // Fetch 1m, aggregate to 5m
    '15m': 'ohlcv-1m',  // Fetch 1m, aggregate to 15m
    '30m': 'ohlcv-1m',  // Fetch 1m, aggregate to 30m
    '1h': 'ohlcv-1h',
    '4h': 'ohlcv-1h',   // Fetch 1h, aggregate to 4h
    '1d': 'ohlcv-1d',
}

// Number of candles to show before and after trade
const CANDLES_BUFFER = 50

// Normalize symbol (handle variations like F.US.MNQ, MNQ, MNQZ24, etc.)
function normalizeSymbol(rawSymbol: string): string {
    let symbol = rawSymbol.toUpperCase()

    // Handle Tradovate format: F.US.MNQ -> MNQ
    if (symbol.startsWith('F.US.')) {
        symbol = symbol.replace('F.US.', '')
    }

    // Remove month/year suffix (e.g., MNQZ24 -> MNQ)
    symbol = symbol.replace(/[FGHJKMNQUVXZ]\d{2}$/i, '')

    return symbol
}

// Convert Databento symbol to API format
function toDatabentoSymbol(symbol: string): string {
    const normalized = normalizeSymbol(symbol)
    return DATABENTO_SYMBOL_MAP[normalized] || `${normalized}.c.0`
}

// Candle type
interface Candle {
    time: number
    open: number
    high: number
    low: number
    close: number
}

// Aggregate 1m candles to larger timeframes (5m, 15m, etc.)
function aggregateCandles(candles: Candle[], intervalMinutes: number): Candle[] {
    if (intervalMinutes <= 1) return candles

    const aggregated: Candle[] = []
    const intervalSeconds = intervalMinutes * 60

    let currentBucket: Candle | null = null

    for (const candle of candles) {
        // Calculate bucket start time
        const bucketStart = Math.floor(candle.time / intervalSeconds) * intervalSeconds

        if (!currentBucket || currentBucket.time !== bucketStart) {
            // Start new bucket
            if (currentBucket) {
                aggregated.push(currentBucket)
            }
            currentBucket = {
                time: bucketStart,
                open: candle.open,
                high: candle.high,
                low: candle.low,
                close: candle.close,
            }
        } else {
            // Extend current bucket
            currentBucket.high = Math.max(currentBucket.high, candle.high)
            currentBucket.low = Math.min(currentBucket.low, candle.low)
            currentBucket.close = candle.close
        }
    }

    // Don't forget the last bucket
    if (currentBucket) {
        aggregated.push(currentBucket)
    }

    return aggregated
}

// Get aggregation interval in minutes
function getAggregationMinutes(interval: string): number {
    const map: Record<string, number> = {
        '1m': 1,
        '5m': 5,
        '15m': 15,
        '30m': 30,
        '1h': 60,
        '4h': 240,
        '1d': 1440,
    }
    return map[interval] || 15
}

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams
    const rawSymbol = searchParams.get('symbol') || 'ES'
    const fromTime = parseInt(searchParams.get('from_time') || '0')
    const toTime = parseInt(searchParams.get('to_time') || '0')
    const interval = searchParams.get('interval') || '15m'

    const databentoSymbol = toDatabentoSymbol(rawSymbol)
    const schema = DATABENTO_SCHEMA_MAP[interval] || 'ohlcv-1m'
    const aggregationMinutes = getAggregationMinutes(interval)

    const DATABENTO_API_KEY = process.env.DATABENTO_API_KEY

    if (!DATABENTO_API_KEY) {
        console.error('DATABENTO_API_KEY not configured')
        return NextResponse.json([])
    }

    try {
        // Calculate time range - requesting 50 candles before and after trade
        let startTime: string
        let endTime: string

        if (fromTime > 0 && toTime > 0) {
            // Add buffer for 50 candles before/after (plus extra for aggregation)
            const intervalMs = getIntervalMs(interval)
            const bufferMs = intervalMs * (CANDLES_BUFFER + 5) // 55 candles buffer on each side
            startTime = new Date((fromTime * 1000) - bufferMs).toISOString()
            endTime = new Date((toTime * 1000) + bufferMs).toISOString()
        } else {
            // Default: last 7 days
            const now = new Date()
            endTime = now.toISOString()
            startTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
        }

        console.log(`Fetching Databento: symbol=${databentoSymbol}, schema=${schema}, interval=${interval}, start=${startTime}, end=${endTime}`)

        // Databento Historical API - timeseries.get_range (using form-urlencoded)
        const url = 'https://hist.databento.com/v0/timeseries.get_range'

        // Build form data
        const formData = new URLSearchParams()
        formData.append('dataset', 'GLBX.MDP3')
        formData.append('symbols', databentoSymbol)
        formData.append('schema', schema)
        formData.append('start', startTime)
        formData.append('end', endTime)
        formData.append('encoding', 'json')
        formData.append('stype_in', 'continuous')
        formData.append('stype_out', 'instrument_id')

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': `Basic ${Buffer.from(DATABENTO_API_KEY + ':').toString('base64')}`,
            },
            body: formData.toString(),
        })

        if (!response.ok) {
            const errorText = await response.text()
            console.error(`Databento API error: ${response.status} - ${errorText}`)
            throw new Error(`Databento returned status ${response.status}`)
        }

        // Databento returns newline-delimited JSON (NDJSON)
        const text = await response.text()
        const lines = text.trim().split('\n').filter(line => line.length > 0)

        if (lines.length === 0) {
            console.log(`No data from Databento for ${databentoSymbol}`)
            return NextResponse.json([])
        }

        // Parse OHLCV data from NDJSON
        // Databento format: {"hd":{"ts_event":"nanoseconds",...},"open":"fixed9","high":"fixed9",...}
        let candles: Candle[] = lines.map(line => {
            try {
                const record = JSON.parse(line)
                // ts_event is in the "hd" (header) object, in nanoseconds as string
                const tsEvent = record.hd?.ts_event || record.ts_event
                // Prices are fixed-point with 1e9 (9 decimal places)
                return {
                    time: Math.floor(Number(tsEvent) / 1000000000), // nanoseconds to seconds
                    open: Number(record.open) / 1000000000,   // Fixed-point 9 decimals
                    high: Number(record.high) / 1000000000,
                    low: Number(record.low) / 1000000000,
                    close: Number(record.close) / 1000000000,
                }
            } catch {
                return null
            }
        }).filter((c): c is Candle =>
            c !== null && c.open > 0 && c.high > 0 && c.low > 0 && c.close > 0
        )

        // Sort by time (oldest first)
        candles.sort((a, b) => a.time - b.time)

        // Aggregate if needed (5m, 15m, 30m, 4h)
        if (aggregationMinutes > 1 && schema === 'ohlcv-1m') {
            candles = aggregateCandles(candles, aggregationMinutes)
        } else if (aggregationMinutes === 240 && schema === 'ohlcv-1h') {
            candles = aggregateCandles(candles, 4) // 4 hours from 1h candles
        }

        console.log(`Returning ${candles.length} ${interval} candles from Databento for ${databentoSymbol}`)

        return NextResponse.json(candles)

    } catch (error) {
        console.error('Error fetching market data from Databento:', error)
        // Return empty array instead of error - frontend will use synthetic data
        return NextResponse.json([])
    }
}

// Helper: Get interval duration in milliseconds
function getIntervalMs(interval: string): number {
    const map: Record<string, number> = {
        '1m': 60 * 1000,
        '5m': 5 * 60 * 1000,
        '15m': 15 * 60 * 1000,
        '30m': 30 * 60 * 1000,
        '1h': 60 * 60 * 1000,
        '4h': 4 * 60 * 60 * 1000,
        '1d': 24 * 60 * 60 * 1000,
    }
    return map[interval] || 15 * 60 * 1000
}
