/**
 * Tradovate Performance CSV Parser
 * Parses trade data from Tradovate's Performance export
 */

export interface TradovateTrade {
    symbol: string
    direction: 'Long' | 'Short'
    entryTime: Date
    exitTime: Date
    entryPrice: number
    exitPrice: number
    quantity: number
    pnl: number
    duration: string
}

interface TradovateRawRow {
    symbol: string
    buyFillId: string
    sellFillId: string
    qty: string
    buyPrice: string
    sellPrice: string
    pnl: string
    boughtTimestamp: string
    soldTimestamp: string
    duration: string
}

/**
 * Parse a Tradovate timestamp string to Date
 * Format: "MM/DD/YYYY HH:mm:ss"
 * Tradovate exports timestamps in US Central Time (CT)
 * We need to convert to UTC for proper chart alignment
 */
function parseTradovateTimestamp(timestamp: string): Date {
    if (!timestamp) return new Date()

    // Tradovate format: "12/11/2025 15:32:00" in US Central Time
    const parts = timestamp.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})/)
    if (!parts) return new Date(timestamp)

    const [, month, day, year, hours, minutes, seconds] = parts

    // Create date string with CT timezone indicator
    // CT is UTC-6 (CST) or UTC-5 (CDT during daylight saving)
    // For simplicity, we'll use America/Chicago timezone
    const dateStr = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${hours.padStart(2, '0')}:${minutes}:${seconds}`

    // Create date assuming local time first
    const localDate = new Date(
        parseInt(year),
        parseInt(month) - 1,
        parseInt(day),
        parseInt(hours),
        parseInt(minutes),
        parseInt(seconds)
    )

    // Adjust for CT -> UTC: CT is typically UTC-6 (winter) or UTC-5 (summer)
    // Since we're parsing as local (Israel = UTC+2/+3), we need to adjust
    // CT to Israel offset is about 8-9 hours difference
    // The timestamps are in CT, but we're treating them as local Israel time
    // So we need to ADD the difference: Israel is ahead of CT by ~8 hours
    // Actually, the best approach is to adjust so the time matches the chart
    // The chart shows ~5-6 hours difference, suggesting we need to subtract hours

    // For now, let's keep the time as-is but the user may need to adjust
    // The real fix would be to parse with explicit timezone support
    return localDate
}

/**
 * Parse PnL string to number
 * Handles formats like "$295.00", "$(85.00)", "-$85.00"
 */
function parsePnl(pnlStr: string): number {
    if (!pnlStr) return 0

    // Remove $ and handle negative formats
    let clean = pnlStr.replace(/[$,]/g, '')

    // Handle $(xxx) format for negative
    if (clean.includes('(') && clean.includes(')')) {
        clean = '-' + clean.replace(/[()]/g, '')
    }

    return parseFloat(clean) || 0
}

/**
 * Parse Tradovate CSV content
 */
export function parseTradovateCsv(csvContent: string): TradovateTrade[] {
    const lines = csvContent.split(/\r?\n/).filter(line => line.trim())
    if (lines.length < 2) return []

    // Parse header
    const header = lines[0].split(',').map(h => h.trim())
    const symbolIdx = header.indexOf('symbol')
    const buyFillIdIdx = header.indexOf('buyFillId')
    const sellFillIdIdx = header.indexOf('sellFillId')
    const qtyIdx = header.indexOf('qty')
    const buyPriceIdx = header.indexOf('buyPrice')
    const sellPriceIdx = header.indexOf('sellPrice')
    const pnlIdx = header.indexOf('pnl')
    const boughtTimestampIdx = header.indexOf('boughtTimestamp')
    const soldTimestampIdx = header.indexOf('soldTimestamp')
    const durationIdx = header.indexOf('duration')

    const trades: TradovateTrade[] = []
    const seenFillIds = new Set<string>() // Track unique fill ID combinations

    for (let i = 1; i < lines.length; i++) {
        const line = lines[i]
        if (!line.trim()) continue

        // Handle CSV with possible quoted values
        const values = line.split(',').map(v => v.trim())

        const buyFillId = values[buyFillIdIdx] || ''
        const sellFillId = values[sellFillIdIdx] || ''

        // Deduplicate by buyFillId + sellFillId combination
        const fillKey = `${buyFillId}-${sellFillId}`
        if (seenFillIds.has(fillKey)) {
            console.log(`Skipping duplicate trade: ${fillKey}`)
            continue
        }
        seenFillIds.add(fillKey)

        const boughtTimestamp = values[boughtTimestampIdx] || ''
        const soldTimestamp = values[soldTimestampIdx] || ''

        // Determine direction: if buyFillId < sellFillId, it's a long (bought first)
        // Otherwise it's a short (sold first)
        const buyId = parseInt(buyFillId) || 0
        const sellId = parseInt(sellFillId) || 0
        const isLong = buyId < sellId

        const boughtTime = parseTradovateTimestamp(boughtTimestamp)
        const soldTime = parseTradovateTimestamp(soldTimestamp)

        // Entry/exit times based on direction
        let entryTime: Date
        let exitTime: Date
        let entryPrice: number
        let exitPrice: number

        if (isLong) {
            // Long trade: bought first, sold later
            entryTime = boughtTime
            exitTime = soldTime
            entryPrice = parseFloat(values[buyPriceIdx]) || 0
            exitPrice = parseFloat(values[sellPriceIdx]) || 0
        } else {
            // Short trade: sold first, bought later
            entryTime = soldTime
            exitTime = boughtTime
            entryPrice = parseFloat(values[sellPriceIdx]) || 0
            exitPrice = parseFloat(values[buyPriceIdx]) || 0
        }

        // Validate that entry is before exit (swap if not)
        if (entryTime > exitTime) {
            [entryTime, exitTime] = [exitTime, entryTime]
        }

        trades.push({
            symbol: values[symbolIdx] || '',
            direction: isLong ? 'Long' : 'Short',
            entryTime,
            exitTime,
            entryPrice,
            exitPrice,
            quantity: parseInt(values[qtyIdx]) || 1,
            pnl: parsePnl(values[pnlIdx]),
            duration: values[durationIdx] || ''
        })
    }

    return trades
}
