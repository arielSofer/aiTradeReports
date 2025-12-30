import { NextRequest, NextResponse } from 'next/server'

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || process.env.NEXT_PUBLIC_OPENROUTER_API_KEY

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

export async function POST(request: NextRequest) {
    try {
        const body: PerformanceReviewRequest = await request.json()
        const { stats, dailyStats, hourlyStats, topAssets } = body

        // Debug log (masked)
        const key = OPENROUTER_API_KEY
        const keyStart = key ? key.substring(0, 10) : 'MISSING'
        console.log(`[ReviewPerformance] Using API Key starting with: ${keyStart}...`)

        if (!OPENROUTER_API_KEY) {
            console.error('[ReviewPerformance] OpenRouter API key not configured')
            return NextResponse.json(
                { error: 'OpenRouter API key not configured' },
                { status: 500 }
            )
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
**1. Risk Management:** ...
**2. Trading Times:** ...
**3. Strategy:** ...`
                    }
                ]
            }
        ]

        // Models to try in order of preference
        const models = [
            'google/gemini-2.0-flash-exp:free',
            'google/gemini-exp-1206:free',
            'meta-llama/llama-3.3-70b-instruct:free',
            'microsoft/phi-4:free'
        ];

        let lastErrorText: string = ''
        let lastStatus: number = 500

        // Try each model until one works
        for (const model of models) {
            console.log(`[ReviewPerformance] Attempting with model: ${model}`)

            try {
                // Small retry loop for EACH model (in case of momentary network blip)
                for (let attempt = 0; attempt < 2; attempt++) {
                    if (attempt > 0) {
                        await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 1000))
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
                            model: model,
                            messages: messages,
                        })
                    })

                    if (response.status === 429) {
                        console.warn(`[ReviewPerformance] Model ${model} rate limited (429).`)
                        lastStatus = 429
                        lastErrorText = "Rate limit"
                        // Break inner loop to move to next model immediately (usually 429s on free tier stick for a bit)
                        break
                    }

                    if (!response.ok) {
                        lastErrorText = await response.text()
                        lastStatus = response.status
                        console.warn(`[ReviewPerformance] Model ${model} error: ${response.status} ${lastErrorText}`)
                        if (response.status >= 500) continue // Retry same model if server error
                        break // Break inner loop for 4xx errors (except 429 handled above) to try next model or fail
                    }

                    const data = await response.json()
                    const review = data.choices?.[0]?.message?.content

                    if (!review) {
                        console.warn(`[ReviewPerformance] Model ${model} returned empty review.`)
                        continue // Retry same model? or break?
                    }

                    return NextResponse.json({ review, model: data.model })
                }
            } catch (error) {
                console.error(`[ReviewPerformance] Error with model ${model}:`, error)
                // Continue to next model
            }
        }

        return NextResponse.json(
            { error: lastErrorText || 'All AI models are currently busy. Please try again later.' },
            { status: lastStatus }
        )

    } catch (error: any) {
        console.error('Error in AI performance review:', error)
        return NextResponse.json(
            { error: 'Failed to generate review' },
            { status: 500 }
        )
    }
}
