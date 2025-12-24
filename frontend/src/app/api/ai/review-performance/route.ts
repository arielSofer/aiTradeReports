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

        if (!OPENROUTER_API_KEY) {
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
**1. ניהול סיכונים:** ...
**2. זמני מסחר:** ...
**3. אסטרטגיה:** ...`
                    }
                ]
            }
        ]

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
            const errorText = await response.text()
            console.error('OpenRouter API error:', response.status, errorText)
            return NextResponse.json({ error: errorText }, { status: response.status })
        }

        const data = await response.json()
        const review = data.choices?.[0]?.message?.content || 'No review generated'

        return NextResponse.json({ review, model: data.model })

    } catch (error: any) {
        console.error('Error in AI performance review:', error)
        return NextResponse.json(
            { error: 'Failed to generate review' },
            { status: 500 }
        )
    }
}
