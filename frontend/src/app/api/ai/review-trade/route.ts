import { NextRequest, NextResponse } from 'next/server'

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || process.env.NEXT_PUBLIC_OPENROUTER_API_KEY || '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'

interface TradeReviewRequest {
  images: string[] // Base64 encoded images
  tradeData: {
    symbol: string
    direction: 'long' | 'short'
    entryTime: string
    exitTime: string
    entryPrice: number
    exitPrice: number
    quantity: number
    pnl: number
    timeframe: string // e.g., "5min", "15min", "1h"
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: TradeReviewRequest = await request.json()
    const { images, tradeData } = body

    if (!images || images.length === 0) {
      return NextResponse.json(
        { error: 'No images provided' },
        { status: 400 }
      )
    }

    if (!OPENROUTER_API_KEY) {
      return NextResponse.json(
        { error: 'OpenRouter API key not configured' },
        { status: 500 }
      )
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
          ...images.map((image, index) => ({
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
        // Wait before retry (exponential backoff)
        if (attempt > 0) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000) // Max 10 seconds
          await new Promise(resolve => setTimeout(resolve, delay))
        }

        // Call OpenRouter API
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
            'X-Title': 'TradeTracker',
          },
          body: JSON.stringify({
            model: 'google/gemini-2.0-flash-exp:free',
            messages: messages,
          })
        })

        if (response.status === 429) {
          // Rate limited - wait longer and retry
          const retryAfter = response.headers.get('Retry-After')
          if (retryAfter) {
            const waitTime = parseInt(retryAfter) * 1000
            if (attempt < maxRetries - 1) {
              await new Promise(resolve => setTimeout(resolve, waitTime))
              continue
            }
          }

          // If we've exhausted retries, return helpful error
          return NextResponse.json(
            {
              error: 'יותר מדי בקשות. אנא נסה שוב בעוד כמה דקות.',
              errorCode: 'RATE_LIMIT',
              retryAfter: retryAfter || '60'
            },
            { status: 429 }
          )
        }

        if (!response.ok) {
          const errorText = await response.text()
          console.error('OpenRouter API error:', response.status, errorText)

          // Don't retry on client errors (4xx) except 429
          if (response.status >= 400 && response.status < 500 && response.status !== 429) {
            return NextResponse.json(
              {
                error: response.status === 401
                  ? 'שגיאת אימות. אנא בדוק את מפתח ה-API.'
                  : response.status === 403
                    ? 'אין הרשאה לגשת לשירות.'
                    : `שגיאת שירות: ${response.status}`,
                errorCode: `HTTP_${response.status}`
              },
              { status: response.status }
            )
          }

          // Retry on server errors (5xx)
          lastError = { status: response.status, message: errorText }
          if (attempt < maxRetries - 1) continue
        } else {
          // Success!
          const data = await response.json()
          const review = data.choices?.[0]?.message?.content || 'No review generated'

          return NextResponse.json({
            review,
            model: data.model
          })
        }
      } catch (fetchError: any) {
        lastError = fetchError
        if (attempt < maxRetries - 1) continue
      }
    }

    // All retries exhausted
    return NextResponse.json(
      {
        error: lastError?.status === 429
          ? 'יותר מדי בקשות. אנא נסה שוב בעוד כמה דקות.'
          : 'שגיאה ביצירת סקירה. אנא נסה שוב מאוחר יותר.',
        errorCode: 'RETRY_EXHAUSTED'
      },
      { status: lastError?.status || 500 }
    )



  } catch (error) {
    console.error('Error in AI review:', error)
    return NextResponse.json(
      { error: 'Failed to generate review' },
      { status: 500 }
    )
  }
}

