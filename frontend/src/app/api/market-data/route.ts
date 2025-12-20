import { NextRequest, NextResponse } from 'next/server'

// Symbol mapping for futures contracts to Databento continuous contracts
const SYMBOL_MAP: Record<string, string> = {
    // Micro E-mini futures
    'MNQ': 'MNQ.c.0',    // Micro Nasdaq-100 continuous front month
    'MES': 'MES.c.0',    // Micro S&P 500
    'M2K': 'M2K.c.0',    // Micro Russell 2000
    'MYM': 'MYM.c.0',    // Micro Dow

    // E-mini futures
    'NQ': 'NQ.c.0',      // E-mini Nasdaq
    'ES': 'ES.c.0',      // E-mini S&P 500
    'RTY': 'RTY.c.0',    // E-mini Russell
    'YM': 'YM.c.0',      // E-mini Dow

    // Commodities
    'GC': 'GC.c.0',      // Gold
    'CL': 'CL.c.0',      // Crude Oil
    'SI': 'SI.c.0',      // Silver
    'NG': 'NG.c.0',      // Natural Gas
}

// Convert interval to Databento schema
const SCHEMA_MAP: Record<string, string> = {
    '1m': 'ohlcv-1m',
    '5m': 'ohlcv-1m',   // Aggregate 1m data
    '15m': 'ohlcv-1m',  // Aggregate 1m data
    '30m': 'ohlcv-1m',  // Aggregate 1m data
    '1h': 'ohlcv-1h',
    '1d': 'ohlcv-1d',
}

// Normalize symbol (handle variations like F.US.MNQ, MNQ, etc.)
function normalizeSymbol(rawSymbol: string): string {
    let symbol = rawSymbol.toUpperCase()

    // Handle Tradovate format: F.US.MNQ -> MNQ
    if (symbol.startsWith('F.US.')) {
        symbol = symbol.replace('F.US.', '')
    }

    // Remove month/year suffix (e.g., MNQZ24 -> MNQ, MNQH25 -> MNQ)
    symbol = symbol.replace(/[FGHJKMNQUVXZ]\d{2}$/i, '')

    // Try direct mapping to Databento continuous contract
    if (SYMBOL_MAP[symbol]) {
        return SYMBOL_MAP[symbol]
    }

    // Default: try as continuous contract
    return `${symbol}.c.0`
}

// Aggregate 1-minute candles to larger intervals
function aggregateCandles(candles: Array<{ time: number; open: number; high: number; low: number; close: number }>, intervalMinutes: number) {
    if (intervalMinutes <= 1) return candles

    const aggregated: Array<{ time: number; open: number; high: number; low: number; close: number }> = []

    for (let i = 0; i < candles.length; i += intervalMinutes) {
        const batch = candles.slice(i, i + intervalMinutes)
        if (batch.length === 0) continue

        aggregated.push({
            time: batch[0].time,
            open: batch[0].open,
            high: Math.max(...batch.map(c => c.high)),
            low: Math.min(...batch.map(c => c.low)),
            close: batch[batch.length - 1].close,
        })
    }

    return aggregated
}

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams
    const rawSymbol = searchParams.get('symbol') || 'MNQ'
    const fromTime = parseInt(searchParams.get('from_time') || '0')
    const toTime = parseInt(searchParams.get('to_time') || '0')
    const interval = searchParams.get('interval') || '15m'

    const symbol = normalizeSymbol(rawSymbol)
    const schema = SCHEMA_MAP[interval] || 'ohlcv-1m'

    // Get interval in minutes for aggregation
    const intervalMinutes = interval === '5m' ? 5 : interval === '15m' ? 15 : interval === '30m' ? 30 : 1

    // Databento API key
    const DATABENTO_API_KEY = process.env.DATABENTO_API_KEY || 'db-HJx7MgX4FT9yyqAvdmP5XxQbJG3Hx'

    try {
        // Calculate time range (30 candles before and after trade)
        // Default to last 2 hours if no time specified
        let startDate: string
        let endDate: string

        if (fromTime > 0 && toTime > 0) {
            // Add buffer for 30 candles before/after
            const bufferSeconds = intervalMinutes * 60 * 35 // 35 candles worth
            startDate = new Date((fromTime - bufferSeconds) * 1000).toISOString()
            endDate = new Date((toTime + bufferSeconds) * 1000).toISOString()
        } else {
            // Default: last 2 hours
            const now = new Date()
            const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000)
            startDate = twoHoursAgo.toISOString()
            endDate = now.toISOString()
        }

        const url = `https://hist.databento.com/v0/timeseries.get_range?dataset=GLBX.MDP3&symbols=${encodeURIComponent(symbol)}&stype_in=continuous&schema=${schema}&start=${startDate}&end=${endDate}&encoding=json`

        console.log(`Fetching Databento: symbol=${symbol}, schema=${schema}`)

        const response = await fetch(url, {
            headers: {
                'Authorization': `Basic ${Buffer.from(DATABENTO_API_KEY + ':').toString('base64')}`,
            },
            next: { revalidate: 60 } // Cache for 1 minute
        })

        if (!response.ok) {
            const errorText = await response.text()
            console.error(`Databento error: ${response.status} - ${errorText}`)
            return NextResponse.json([])
        }

        // Databento returns newline-delimited JSON
        const text = await response.text()
        const lines = text.trim().split('\n').filter(line => line.trim())

        // Parse each line as JSON
        const candles = lines.map(line => {
            try {
                const data = JSON.parse(line)
                // ts_event is in nanoseconds, prices are fixed-point (divide by 1e9)
                return {
                    time: Math.floor(parseInt(data.hd.ts_event) / 1e9),
                    open: parseInt(data.open) / 1e9,
                    high: parseInt(data.high) / 1e9,
                    low: parseInt(data.low) / 1e9,
                    close: parseInt(data.close) / 1e9,
                }
            } catch {
                return null
            }
        }).filter((c): c is { time: number; open: number; high: number; low: number; close: number } =>
            c !== null && c.open > 0 && c.high > 0 && c.low > 0 && c.close > 0
        )

        // Aggregate if needed (for 5m, 15m, 30m intervals)
        const aggregatedCandles = aggregateCandles(candles, intervalMinutes)

        // Sort by time and take last 60 candles
        const sortedCandles = aggregatedCandles.sort((a, b) => a.time - b.time).slice(-60)

        console.log(`Returning ${sortedCandles.length} candles for ${symbol}`)

        return NextResponse.json(sortedCandles)

    } catch (error) {
        console.error('Error fetching market data:', error)
        return NextResponse.json([])
    }
}
