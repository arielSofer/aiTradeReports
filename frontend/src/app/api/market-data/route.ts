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
const DATABENTO_SCHEMA_MAP: Record<string, string> = {
    '1m': 'ohlcv-1m',
    '5m': 'ohlcv-1m',   // Use 1m and aggregate if needed, or closest
    '15m': 'ohlcv-1m',  // Use 1m
    '30m': 'ohlcv-1m',  // Use 1m
    '1h': 'ohlcv-1h',
    '4h': 'ohlcv-1h',   // Use 1h
    '1d': 'ohlcv-1d',
}

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

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams
    const rawSymbol = searchParams.get('symbol') || 'ES'
    const fromTime = parseInt(searchParams.get('from_time') || '0')
    const toTime = parseInt(searchParams.get('to_time') || '0')
    const interval = searchParams.get('interval') || '15m'

    const databentoSymbol = toDatabentoSymbol(rawSymbol)
    const schema = DATABENTO_SCHEMA_MAP[interval] || 'ohlcv-1m'

    const DATABENTO_API_KEY = process.env.DATABENTO_API_KEY

    if (!DATABENTO_API_KEY) {
        console.error('DATABENTO_API_KEY not configured')
        return NextResponse.json([])
    }

    try {
        // Calculate time range - requesting 30 candles before and after trade
        // Default to last 7 days if no time range specified
        let startTime: string
        let endTime: string

        if (fromTime > 0 && toTime > 0) {
            // Add buffer for 30 candles before/after
            const intervalMs = getIntervalMs(interval)
            const bufferMs = intervalMs * 35 // 35 candles buffer on each side
            startTime = new Date((fromTime * 1000) - bufferMs).toISOString()
            endTime = new Date((toTime * 1000) + bufferMs).toISOString()
        } else {
            // Default: last 7 days
            const now = new Date()
            endTime = now.toISOString()
            startTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
        }

        console.log(`Fetching Databento: symbol=${databentoSymbol}, schema=${schema}, start=${startTime}, end=${endTime}`)

        // Databento Historical API - timeseries.get_range
        const url = 'https://hist.databento.com/v0/timeseries.get_range'

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Basic ${Buffer.from(DATABENTO_API_KEY + ':').toString('base64')}`,
            },
            body: JSON.stringify({
                dataset: 'GLBX.MDP3',
                symbols: [databentoSymbol],
                schema: schema,
                start: startTime,
                end: endTime,
                encoding: 'json',
                stype_in: 'continuous',
                stype_out: 'instrument_id',
            }),
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
        const candles = lines.map(line => {
            try {
                const record = JSON.parse(line)
                // Databento OHLCV fields: ts_event (nanoseconds), open, high, low, close, volume
                return {
                    time: Math.floor(record.ts_event / 1000000000), // nanoseconds to seconds
                    open: record.open / 1000000000,   // Databento uses fixed-point (9 decimal places)
                    high: record.high / 1000000000,
                    low: record.low / 1000000000,
                    close: record.close / 1000000000,
                }
            } catch {
                return null
            }
        }).filter((c): c is NonNullable<typeof c> =>
            c !== null && c.open > 0 && c.high > 0 && c.low > 0 && c.close > 0
        )

        // Sort by time (oldest first)
        candles.sort((a, b) => a.time - b.time)

        console.log(`Returning ${candles.length} candles from Databento for ${databentoSymbol}`)

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
