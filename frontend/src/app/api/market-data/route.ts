import { NextRequest, NextResponse } from 'next/server'

// Symbol mapping for futures contracts - map to ETFs (work with free tier)
const SYMBOL_MAP: Record<string, string> = {
    // Micro E-mini futures -> Index-tracking ETFs
    'MNQ': 'QQQ',     // Micro Nasdaq-100 -> Invesco QQQ ETF
    'MES': 'SPY',     // Micro S&P 500 -> SPDR S&P 500 ETF
    'M2K': 'IWM',     // Micro Russell 2000 -> iShares Russell 2000
    'MYM': 'DIA',     // Micro Dow -> SPDR Dow Jones
    'MCL': 'USO',     // Micro Crude Oil -> US Oil Fund
    'MGC': 'GLD',     // Micro Gold -> SPDR Gold

    // E-mini futures
    'NQ': 'QQQ',      // E-mini Nasdaq
    'ES': 'SPY',      // E-mini S&P 500
    'RTY': 'IWM',     // E-mini Russell
    'YM': 'DIA',      // E-mini Dow

    // Commodities
    'GC': 'GLD',      // Gold
    'CL': 'USO',      // Crude Oil
    'SI': 'SLV',      // Silver
    'NG': 'UNG',      // Natural Gas

    // Crypto
    'BTC': 'BTC/USD',
    'ETH': 'ETH/USD',
}

// Convert interval to Twelve Data format
const INTERVAL_MAP: Record<string, string> = {
    '1m': '1min',
    '5m': '5min',
    '15m': '15min',
    '30m': '30min',
    '1h': '1h',
    '4h': '4h',
    '1d': '1day',
}

// Normalize symbol (handle variations like F.US.MNQ, MNQ, etc.)
function normalizeSymbol(rawSymbol: string): string {
    let symbol = rawSymbol.toUpperCase()

    // Handle Tradovate format: F.US.MNQ -> MNQ
    if (symbol.startsWith('F.US.')) {
        symbol = symbol.replace('F.US.', '')
    }

    // Remove month/year suffix (e.g., MNQZ24 -> MNQ)
    symbol = symbol.replace(/[FGHJKMNQUVXZ]\d{2}$/i, '')

    // Try direct mapping
    if (SYMBOL_MAP[symbol]) {
        return SYMBOL_MAP[symbol]
    }

    // If it looks like a stock ticker, return as-is
    if (/^[A-Z]{1,5}$/.test(symbol)) {
        return symbol
    }

    // Default: return normalized symbol
    return symbol
}

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams
    const rawSymbol = searchParams.get('symbol') || 'ES'
    const fromTime = parseInt(searchParams.get('from_time') || '0')
    const toTime = parseInt(searchParams.get('to_time') || '0')
    const interval = searchParams.get('interval') || '15m'

    const symbol = normalizeSymbol(rawSymbol)
    const twelveInterval = INTERVAL_MAP[interval] || '15min'

    // Twelve Data API (free tier: 800 calls/day, 8 calls/minute)
    const TWELVE_DATA_API_KEY = process.env.TWELVE_DATA_API_KEY || 'da329292b81d408ebd73740386993251'

    try {
        // We want 15 candles before + trade duration + 15 candles after
        // Request 50 candles to have buffer
        const outputSize = 50

        // Build URL with optional start/end dates
        let url = `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(symbol)}&interval=${twelveInterval}&outputsize=${outputSize}&apikey=${TWELVE_DATA_API_KEY}`

        // If we have specific time range, convert to dates
        if (fromTime > 0 && toTime > 0) {
            const startDate = new Date(fromTime * 1000).toISOString().split('T')[0]
            const endDate = new Date(toTime * 1000).toISOString().split('T')[0]
            url += `&start_date=${startDate}&end_date=${endDate}`
        }

        console.log(`Fetching Twelve Data: symbol=${symbol}, interval=${twelveInterval}`)

        const response = await fetch(url, {
            next: { revalidate: 60 } // Cache for 1 minute
        })

        if (!response.ok) {
            throw new Error(`Twelve Data returned status ${response.status}`)
        }

        const data = await response.json()

        if (data.status === 'error' || !data.values || data.values.length === 0) {
            console.log(`No data from Twelve Data for ${symbol}: ${data.message || 'no values'}`)
            // Return empty array - frontend will use synthetic data
            return NextResponse.json([])
        }

        // Build candle data - Twelve Data returns newest first, so reverse
        const candles = data.values
            .map((v: { datetime: string; open: string; high: string; low: string; close: string }) => ({
                time: Math.floor(new Date(v.datetime).getTime() / 1000),
                open: parseFloat(v.open),
                high: parseFloat(v.high),
                low: parseFloat(v.low),
                close: parseFloat(v.close),
            }))
            .filter((c: { open: number; high: number; low: number; close: number }) =>
                c.open > 0 && c.high > 0 && c.low > 0 && c.close > 0
            )
            .reverse() // Oldest first

        console.log(`Returning ${candles.length} candles for ${symbol}`)

        return NextResponse.json(candles)

    } catch (error) {
        console.error('Error fetching market data:', error)
        // Return empty array instead of error - frontend will use synthetic data
        return NextResponse.json([])
    }
}
