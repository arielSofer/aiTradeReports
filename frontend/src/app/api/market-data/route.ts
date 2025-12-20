import { NextRequest, NextResponse } from 'next/server'

// Symbol mapping for futures contracts to Yahoo Finance format
const SYMBOL_MAP: Record<string, string> = {
    // Micro E-mini futures -> E-mini (Yahoo has E-mini, not Micro)
    'MNQ': 'NQ=F',    // Micro Nasdaq-100 -> E-mini Nasdaq
    'MES': 'ES=F',    // Micro S&P 500 -> E-mini S&P
    'M2K': 'RTY=F',   // Micro Russell 2000 -> E-mini Russell
    'MYM': 'YM=F',    // Micro Dow -> E-mini Dow
    'MCL': 'CL=F',    // Micro Crude Oil -> Crude Oil
    'MGC': 'GC=F',    // Micro Gold -> Gold

    // E-mini futures
    'NQ': 'NQ=F',     // E-mini Nasdaq
    'ES': 'ES=F',     // E-mini S&P 500
    'RTY': 'RTY=F',   // E-mini Russell
    'YM': 'YM=F',     // E-mini Dow

    // Commodities
    'GC': 'GC=F',     // Gold
    'CL': 'CL=F',     // Crude Oil
    'SI': 'SI=F',     // Silver
    'NG': 'NG=F',     // Natural Gas

    // Crypto
    'BTC': 'BTC-USD',
    'ETH': 'ETH-USD',
}

// Convert interval to Yahoo Finance format
const INTERVAL_MAP: Record<string, string> = {
    '1m': '1m',
    '5m': '5m',
    '15m': '15m',
    '30m': '30m',
    '1h': '1h',
    '4h': '1h',  // Yahoo doesn't have 4h, use 1h
    '1d': '1d',
}

// Get range for Yahoo Finance API based on interval
function getYahooRange(interval: string): string {
    switch (interval) {
        case '1m': return '1d'   // 1 day for 1-minute
        case '5m': return '5d'   // 5 days for 5-minute
        case '15m': return '5d'  // 5 days for 15-minute
        case '30m': return '5d'  // 5 days for 30-minute
        case '1h': return '1mo'  // 1 month for hourly
        case '1d': return '3mo'  // 3 months for daily
        default: return '5d'
    }
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

    // Try direct mapping
    if (SYMBOL_MAP[symbol]) {
        return SYMBOL_MAP[symbol]
    }

    // If it already looks like a Yahoo futures symbol, return as-is
    if (symbol.endsWith('=F') || symbol.endsWith('-USD')) {
        return symbol
    }

    // If it looks like a stock ticker, return as-is
    if (/^[A-Z]{1,5}$/.test(symbol)) {
        return symbol
    }

    // Default: return NQ=F for unknown futures
    return 'NQ=F'
}

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams
    const rawSymbol = searchParams.get('symbol') || 'MNQ'
    const interval = searchParams.get('interval') || '15m'

    const symbol = normalizeSymbol(rawSymbol)
    const yahooInterval = INTERVAL_MAP[interval] || '15m'
    const yahooRange = getYahooRange(interval)

    try {
        // Yahoo Finance Chart API - free, no API key required
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=${yahooInterval}&range=${yahooRange}`

        console.log(`Fetching Yahoo Finance: symbol=${symbol}, interval=${yahooInterval}, range=${yahooRange}`)

        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            },
            next: { revalidate: 60 } // Cache for 1 minute
        })

        if (!response.ok) {
            console.log(`Yahoo Finance returned status ${response.status}`)
            return NextResponse.json([])
        }

        const data = await response.json()

        if (!data.chart?.result?.[0]) {
            console.log(`No data from Yahoo Finance for ${symbol}`)
            return NextResponse.json([])
        }

        const result = data.chart.result[0]
        const timestamps = result.timestamp || []
        const quote = result.indicators?.quote?.[0] || {}

        if (!timestamps.length || !quote.open) {
            console.log(`Empty quote data for ${symbol}`)
            return NextResponse.json([])
        }

        // Build candle data
        const candles = timestamps
            .map((time: number, i: number) => ({
                time,
                open: quote.open[i],
                high: quote.high[i],
                low: quote.low[i],
                close: quote.close[i],
            }))
            .filter((c: { open: number | null; high: number | null; low: number | null; close: number | null }) =>
                c.open !== null && c.high !== null && c.low !== null && c.close !== null &&
                c.open > 0 && c.high > 0 && c.low > 0 && c.close > 0
            )

        console.log(`Returning ${candles.length} candles for ${symbol}`)

        return NextResponse.json(candles)

    } catch (error) {
        console.error('Error fetching market data:', error)
        return NextResponse.json([])
    }
}
