/**
 * Client-side OpenRouter API client
 * Used for GitHub Pages deployment where API routes don't work
 */

const OPENROUTER_API_KEY = process.env.NEXT_PUBLIC_OPENROUTER_API_KEY || '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'

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
        throw new Error(`יותר מדי בקשות. אנא נסה שוב בעוד כמה דקות.`)
      }

      if (!response.ok) {
        const errorText = await response.text()
        if (response.status >= 400 && response.status < 500 && response.status !== 429) {
          throw new Error(
            response.status === 401
              ? 'שגיאת אימות. אנא בדוק את מפתח ה-API.'
              : `שגיאת שירות: ${response.status}`
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
    lastError?.message || 'שגיאה ביצירת סקירה. אנא נסה שוב מאוחר יותר.'
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
  const { stats, dailyStats, hourlyStats, topAssets } = request

  if (!OPENROUTER_API_KEY) {
    throw new Error('OpenRouter API key not configured')
  }

  const messages = [
    {
      role: 'user',
      content: [
        {
          type: 'text',
          text: `Please analyze my trading performance and provide exactly 3 actionable tips for improvement.

Performance Stats:
- Win Rate: ${stats.winRate.toFixed(1)}%
- Profit Factor: ${stats.profitFactor.toFixed(2)}
- Total P&L: $${stats.totalPnl.toFixed(2)}
- Avg Win: $${stats.avgWin.toFixed(2)}
- Avg Loss: $${stats.avgLoss.toFixed(2)}
- Max Drawdown: $${stats.maxDrawdown.toFixed(2)}
- Expectancy: $${stats.expectancy.toFixed(2)}

Daily Performance (Best/Worst):
${dailyStats.map(d => `- ${d.day}: $${d.pnl.toFixed(0)} (${d.winRate.toFixed(0)}% WR)`).join('\n')}

Hourly Performance (Best/Worst):
${hourlyStats.slice(0, 5).map(h => `- ${h.hour}: $${h.pnl.toFixed(0)}`).join('\n')}...

Top Assets:
${topAssets.map(a => `- ${a.name}: $${a.value.toFixed(0)}`).join('\n')}

Based on this data, assume the role of a professional trading psychologist and risk manager.
Provide:
1. One tip regarding Risk Management.
2. One tip regarding Timing/Schedule (based on daily/hourly stats).
3. One tip regarding Asset Selection or Strategy.

Format the response as a simple JSON-like markdown list with bold headers in Hebrew.
Example:
**1. ניהול סיכונים:** ...
**2. זמני מסחר:** ...
**3. אסטרטגיה:** ...`
        }
      ]
    }
  ]

  // Reuse the same fetch logic
  try {
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

    if (!response.ok) {
      throw new Error('Failed to fetch AI review')
    }

    const data = await response.json()
    const review = data.choices?.[0]?.message?.content || 'No review generated'
    return { review, model: data.model }
  } catch (error: any) {
    console.error('AI Request failed:', error)
    throw new Error(error.message || 'AI request failed')
  }
}





