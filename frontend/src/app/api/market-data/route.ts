import { NextRequest, NextResponse } from 'next/server'

// Symbol mapping for futures contracts
const SYMBOL_MAP: Record<string, string> = {
    // Micro E-mini futures
    'MNQ': 'NQ=F',  // Micro Nasdaq
    'MES': 'ES=F',  // Micro S&P 500
    'M2K': 'RTY=F', // Micro Russell
    'MYM': 'YM=F',  // Micro Dow
    'MCL': 'CL=F',  // Micro Crude Oil
    'MGC': 'GC=F',  // Micro Gold

    // E-mini futures
    'NQ': 'NQ=F',
    'ES': 'ES=F',
    'RTY': 'RTY=F',
    'YM': 'YM=F',

    // Commodities
    'GC': 'GC=F',
    'CL': 'CL=F',
    'SI': 'SI=F',
    'NG': 'NG=F',

    // Forex
    'EUR': 'EURUSD=X',
    'GBP': 'GBPUSD=X',
    'JPY': 'USDJPY=X',

    // Crypto
    'BTC': 'BTC-USD',
    'ETH': 'ETH-USD',
}

// Convert interval to Yahoo format
const INTERVAL_MAP: Record<string, string> = {
    '1m': '1m',
    '5m': '5m',
    '15m': '15m',
    '30m': '30m',
    '1h': '60m',
    '1d': '1d',
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

    // If it looks like a stock, return as-is
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
    const yahooInterval = INTERVAL_MAP[interval] || '15m'

    try {
        // Calculate range based on time difference
        const timeDiff = toTime - fromTime
        let range = '5d' // default

        if (timeDiff <= 3600) { // 1 hour
            range = '1d'
        } else if (timeDiff <= 86400) { // 1 day
            range = '5d'
        } else if (timeDiff <= 604800) { // 1 week
            range = '1mo'
        } else {
            range = '3mo'
        }

        // For intraday intervals, we need to use the right range
        if (yahooInterval.includes('m')) {
            // Intraday data is limited on Yahoo
            range = '5d' // Max for 1m/5m/15m is 7 days
        }

        // Fetch from Yahoo Finance chart API
        const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=${yahooInterval}&range=${range}&includePrePost=true`

        console.log(`Fetching Yahoo Finance: ${yahooUrl}`)

        const response = await fetch(yahooUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            },
            next: { revalidate: 60 } // Cache for 1 minute
        })

        if (!response.ok) {
            console.error(`Yahoo Finance returned status ${response.status}`)
            return NextResponse.json(
                { error: `Failed to fetch data for ${symbol}` },
                { status: response.status }
            )
        }

        const data = await response.json()

        if (data.chart?.error) {
            console.error('Yahoo Finance error:', data.chart.error)
            return NextResponse.json(
                { error: data.chart.error.description || 'Symbol not found' },
                { status: 404 }
            )
        }

        const result = data.chart?.result?.[0]
        if (!result) {
            return NextResponse.json(
                { error: 'No data returned' },
                { status: 404 }
            )
        }

        const timestamps = result.timestamp || []
        const quote = result.indicators?.quote?.[0] || {}

        // Build candle data
        const candles = timestamps.map((time: number, i: number) => ({
            time,
            open: quote.open?.[i] || 0,
            high: quote.high?.[i] || 0,
            low: quote.low?.[i] || 0,
            close: quote.close?.[i] || 0,
        }))
            .filter((c: any) => c.open > 0 && c.high > 0 && c.low > 0 && c.close > 0)

        // Filter to requested time range (with some buffer)
        const bufferSeconds = yahooInterval.includes('m') ? 3600 : 86400
        const filteredCandles = candles.filter((c: any) =>
            c.time >= fromTime - bufferSeconds && c.time <= toTime + bufferSeconds
        )

        // If no candles in range, return all (better than empty)
        const finalCandles = filteredCandles.length > 0 ? filteredCandles : candles.slice(-60)

        console.log(`Returning ${finalCandles.length} candles for ${symbol}`)

        return NextResponse.json(finalCandles)

    } catch (error) {
        console.error('Error fetching market data:', error)
        return NextResponse.json(
            { error: 'Failed to fetch market data' },
            { status: 500 }
        )
    }
}
