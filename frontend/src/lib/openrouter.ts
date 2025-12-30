/**
 * Client-side OpenRouter API client
 * Used for GitHub Pages deployment where API routes don't work
 */

const OPENROUTER_API_KEY = process.env.NEXT_PUBLIC_OPENROUTER_API_KEY

interface TradeReviewRequest {
  images: string[]
  tradeData: {
    symbol: string
    direction: 'long' | 'short'
    entryTime: string
    exitTime: string
    entryPrice: number
    exitPrice: number
    quantity: number
    pnl: number
    timeframe: string
  }
}

export async function generateTradeReview(request: TradeReviewRequest): Promise<{ review: string; model?: string }> {
  const { images, tradeData } = request

  if (!images || images.length === 0) {
    throw new Error('No images provided')
  }

  if (!OPENROUTER_API_KEY) {
    throw new Error('OpenRouter API key not configured')
  }

  // Prepare messages for OpenRouter
  const messages = [
    {
      role: 'user',
      content: [
        {
          type: 'text',
          text: `Please review this ${tradeData.direction} trade on ${tradeData.symbol}:

Trade Details:
- Symbol: ${tradeData.symbol}
- Direction: ${tradeData.direction.toUpperCase()}
- Entry Time: ${new Date(tradeData.entryTime).toLocaleString()}
- Exit Time: ${new Date(tradeData.exitTime).toLocaleString()}
- Entry Price: $${tradeData.entryPrice.toLocaleString()}
- Exit Price: $${tradeData.exitPrice.toLocaleString()}
- Quantity: ${tradeData.quantity}
- P&L: $${tradeData.pnl.toFixed(2)}
- Timeframes: 5min, 15min, 1h

Please analyze:
1. Entry timing and quality
2. Exit timing and quality
3. Risk management
4. Overall trade execution
5. What could be improved
6. Strengths of the trade

Respond in Hebrew.`
        },
        ...images.map((image) => ({
          type: 'image_url',
          image_url: {
            url: image.startsWith('data:') ? image : `data:image/png;base64,${image}`
          }
        }))
      ]
    }
  ]

  // Retry logic with exponential backoff
  const maxRetries = 3
  let lastError: any = null

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      if (attempt > 0) {
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000)
        await new Promise(resolve => setTimeout(resolve, delay))
      }

      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL || 'https://arielsofer.github.io/aiTradeReports',
          'X-Title': 'TradeTracker',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.0-flash-exp:free',
          messages: messages,
        })
      })

      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After')
        if (retryAfter && attempt < maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, parseInt(retryAfter) * 1000))
          continue
        }
        throw new Error(`Too many requests. Please try again in a few minutes.`)
      }

      if (!response.ok) {
        const errorText = await response.text()
        if (response.status >= 400 && response.status < 500 && response.status !== 429) {
          throw new Error(
            response.status === 401
              ? 'Authentication error. Please check your API key.'
              : `Service error: ${response.status}`
          )
        }
        lastError = { status: response.status, message: errorText }
        if (attempt < maxRetries - 1) continue
      } else {
        const data = await response.json()
        const review = data.choices?.[0]?.message?.content || 'No review generated'
        return { review, model: data.model }
      }
    } catch (fetchError: any) {
      lastError = fetchError
      if (attempt < maxRetries - 1) continue
    }
  }

  throw new Error(
    lastError?.message || 'Error creating review. Please try again later.'
  )
}

interface PerformanceReviewRequest {
  stats: {
    winRate: number
    profitFactor: number
    totalPnl: number
    avgWin: number
    avgLoss: number
    maxDrawdown: number
    expectancy: number
  }
  dailyStats: { day: string; pnl: number; winRate: number }[]
  hourlyStats: { hour: string; pnl: number }[]
  topAssets: { name: string; value: number }[]
}

export async function generatePerformanceReview(request: PerformanceReviewRequest): Promise<{ review: string; model?: string }> {
  try {
    const response = await fetch('/api/ai/review-performance', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request)
    })

    if (!response.ok) {
      const errorText = await response.text()
      try {
        const errorJson = JSON.parse(errorText)
        throw new Error(errorJson.error || 'Failed to fetch AI review')
      } catch (e) {
        throw new Error(`Failed to fetch AI review: ${response.status} ${response.statusText}`)
      }
    }

    const data = await response.json()
    return { review: data.review, model: data.model }
  } catch (error: any) {
    console.error('AI Request failed:', error)

    // Improve error message for known cases
    let message = error.message || 'AI request failed'
    if (message.includes('429') || message.includes('Too Many Requests')) {
      message = 'AI services are currently busy (Rate Limit). Please try again in a minute.'
    } else if (message.includes('503') || message.includes('500')) {
      message = 'AI service temporarily unavailable. Please try again later.'
    }

    throw new Error(message)
  }
}
