import { NextRequest, NextResponse } from 'next/server'

// Symbol mapping for futures contracts - map to stock equivalents for data
const SYMBOL_MAP: Record<string, string> = {
    // Micro E-mini futures -> ETF/Index proxy
    'MNQ': 'QQQ',   // Micro Nasdaq -> Nasdaq ETF
    'MES': 'SPY',   // Micro S&P 500 -> S&P ETF
    'M2K': 'IWM',   // Micro Russell -> Russell ETF
    'MYM': 'DIA',   // Micro Dow -> Dow ETF
    'MCL': 'USO',   // Micro Crude -> Oil ETF
    'MGC': 'GLD',   // Micro Gold -> Gold ETF

    // E-mini futures
    'NQ': 'QQQ',
    'ES': 'SPY',
    'RTY': 'IWM',
    'YM': 'DIA',

    // Commodities
    'GC': 'GLD',
    'CL': 'USO',
    'SI': 'SLV',

    // Crypto
    'BTC': 'COIN',
    'ETH': 'COIN',
}

// Convert interval to Finnhub format
const FINNHUB_RESOLUTION: Record<string, string> = {
    '1m': '1',
    '5m': '5',
    '15m': '15',
    '30m': '30',
    '1h': '60',
    '1d': 'D',
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
    const resolution = FINNHUB_RESOLUTION[interval] || '15'

    // Finnhub API (free tier: 60 calls/minute)
    const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY || 'demo'

    try {
        // Expand time range to ensure we get 30+ candles before and after
        const intervalSeconds = parseInt(resolution) * 60 || 3600
        const expandedFrom = fromTime - (30 * intervalSeconds)
        const expandedTo = toTime + (30 * intervalSeconds)

        // Fetch from Finnhub
        const finnhubUrl = `https://finnhub.io/api/v1/stock/candle?symbol=${encodeURIComponent(symbol)}&resolution=${resolution}&from=${expandedFrom}&to=${expandedTo}&token=${FINNHUB_API_KEY}`

        console.log(`Fetching Finnhub: symbol=${symbol}, resolution=${resolution}`)

        const response = await fetch(finnhubUrl, {
            next: { revalidate: 60 } // Cache for 1 minute
        })

        if (!response.ok) {
            throw new Error(`Finnhub returned status ${response.status}`)
        }

        const data = await response.json()

        if (data.s === 'no_data' || !data.t || data.t.length === 0) {
            console.log(`No data from Finnhub for ${symbol}, returning empty...`)
            // Return empty array - frontend will use synthetic data
            return NextResponse.json([])
        }

        // Build candle data
        const candles = data.t.map((time: number, i: number) => ({
            time,
            open: data.o[i],
            high: data.h[i],
            low: data.l[i],
            close: data.c[i],
        }))
            .filter((c: { open: number; high: number; low: number; close: number }) =>
                c.open > 0 && c.high > 0 && c.low > 0 && c.close > 0
            )
            .sort((a: { time: number }, b: { time: number }) => a.time - b.time)

        console.log(`Returning ${candles.length} candles for ${symbol}`)

        return NextResponse.json(candles)

    } catch (error) {
        console.error('Error fetching market data:', error)
        // Return empty array instead of error - frontend will use synthetic data
        return NextResponse.json([])
    }
}
