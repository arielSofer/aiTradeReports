import { NextRequest, NextResponse } from 'next/server'

/**
 * TopstepX Trade interface from API response
 * Note: The API provides limited data - no entry/exit prices
 */
interface TopstepXApiTrade {
  id: number
  symbolId: string           // e.g. "F.US.MNQ"
  positionSize: number       // negative = short, positive = long
  profitAndLoss: number      // PnL
  fees: number              // fees
  entryPrice: number | null  // Usually 0 or null in API
  exitPrice: number | null   // Usually null in API
  tradeDay: string          // ISO string - trading day
  createdAt: string         // ISO string - when trade was closed
  enteredAt: string         // ISO string - often invalid
}

/**
 * Get symbol name for futures contracts
 */
function getSymbolName(symbolId: string): string {
  // Convert from TopstepX format (e.g., "F.US.MNQ") to display format (e.g., "/MNQ")
  const parts = symbolId.split('.')
  if (parts.length >= 3) {
    return `/${parts[2]}`
  }
  return symbolId
}

/**
 * Generate a unique trade ID
 */
function generateTradeId(trade: TopstepXApiTrade, index: number): string {
  // Use tradeDay + createdAt timestamp + index for uniqueness
  const timestamp = new Date(trade.createdAt).getTime()
  return `${trade.tradeDay.slice(0, 10)}-${timestamp}-${index}`
}

/**
 * POST endpoint to fetch trades from TopstepX API
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { tradingAccountId } = body

    if (!tradingAccountId) {
      return NextResponse.json(
        { error: 'Missing tradingAccountId parameter' },
        { status: 400 }
      )
    }

    const apiUrl = 'https://userapi.topstepx.com/Statistics/trades'
    
    const payload = {
      tradingAccountId: Number(tradingAccountId),
      fromDate: '2020-01-01T00:00:00Z',
      toDate: '2030-12-31T23:59:59Z'
    }

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Origin': 'https://topstepx.com',
        'Referer': 'https://topstepx.com/',
      },
      body: JSON.stringify(payload)
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('TopstepX API error:', response.status, errorText)
      return NextResponse.json(
        { error: `TopstepX API error: ${response.status}` },
        { status: response.status }
      )
    }

    const trades: TopstepXApiTrade[] = await response.json()

    // Transform to our format
    const transformedTrades = trades.map((trade, index) => {
      // The API doesn't provide real entry/exit prices
      // We'll set placeholder values and show the P&L directly
      const direction = trade.positionSize > 0 ? 'long' : 'short'
      
      return {
        id: generateTradeId(trade, index),
        symbol: getSymbolName(trade.symbolId),
        quantity: Math.abs(trade.positionSize),
        entryTime: trade.createdAt, // Use createdAt as trade time
        exitTime: trade.createdAt,
        duration: '',
        // API doesn't provide real prices - use 0 as placeholder
        entryPrice: trade.entryPrice || 0,
        exitPrice: trade.exitPrice || 0,
        pnl: trade.profitAndLoss,
        commission: 0,
        fees: trade.fees,
        direction: direction as 'long' | 'short',
        // Flag that prices are not available
        hasPrices: !!(trade.entryPrice && trade.exitPrice),
      }
    })

    return NextResponse.json({ 
      trades: transformedTrades,
      count: transformedTrades.length,
      source: 'api',
      notice: 'TopstepX API provides limited data. Entry/exit prices may not be available.'
    })

  } catch (error) {
    console.error('Error fetching TopstepX trades:', error)
    return NextResponse.json(
      { error: 'Failed to fetch trades from TopstepX API' },
      { status: 500 }
    )
  }
}

/**
 * GET endpoint with shareId as query param
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const shareId = searchParams.get('share') || searchParams.get('tradingAccountId')

  if (!shareId) {
    return NextResponse.json(
      { error: 'Missing share or tradingAccountId parameter' },
      { status: 400 }
    )
  }

  try {
    const apiUrl = 'https://userapi.topstepx.com/Statistics/trades'
    
    const payload = {
      tradingAccountId: Number(shareId),
      fromDate: '2020-01-01T00:00:00Z',
      toDate: '2030-12-31T23:59:59Z'
    }

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Origin': 'https://topstepx.com',
        'Referer': 'https://topstepx.com/',
      },
      body: JSON.stringify(payload)
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('TopstepX API error:', response.status, errorText)
      return NextResponse.json(
        { error: `TopstepX API error: ${response.status}` },
        { status: response.status }
      )
    }

    const trades: TopstepXApiTrade[] = await response.json()

    // Transform to our format
    const transformedTrades = trades.map((trade, index) => {
      const direction = trade.positionSize > 0 ? 'long' : 'short'
      
      return {
        id: generateTradeId(trade, index),
        symbol: getSymbolName(trade.symbolId),
        quantity: Math.abs(trade.positionSize),
        entryTime: trade.createdAt,
        exitTime: trade.createdAt,
        duration: '',
        entryPrice: trade.entryPrice || 0,
        exitPrice: trade.exitPrice || 0,
        pnl: trade.profitAndLoss,
        commission: 0,
        fees: trade.fees,
        direction: direction as 'long' | 'short',
        hasPrices: !!(trade.entryPrice && trade.exitPrice),
      }
    })

    return NextResponse.json({ 
      trades: transformedTrades,
      count: transformedTrades.length,
      source: 'api',
      notice: 'TopstepX API provides limited data. Entry/exit prices may not be available.'
    })

  } catch (error) {
    console.error('Error fetching TopstepX trades:', error)
    return NextResponse.json(
      { error: 'Failed to fetch trades from TopstepX API' },
      { status: 500 }
    )
  }
}
