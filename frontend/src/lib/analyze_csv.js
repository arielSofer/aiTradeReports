
const fs = require('fs')

function parseTradovateTimestamp(timestamp) {
    if (!timestamp) return new Date()
    const parts = timestamp.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})/)
    if (!parts) return new Date(timestamp)
    const [, month, day, year, hours, minutes, seconds] = parts
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day), parseInt(hours), parseInt(minutes), parseInt(seconds))
}

function parsePnl(pnlStr) {
    if (!pnlStr) return 0
    let clean = pnlStr.replace(/[$,]/g, '')
    if (clean.includes('(') && clean.includes(')')) {
        clean = '-' + clean.replace(/[()]/g, '')
    }
    return parseFloat(clean) || 0
}

function analyze() {
    const content = fs.readFileSync('/Users/ariels/TradeTracker/Performance (2).csv', 'utf8')
    // Strip BOM
    const cleanContent = content.replace(/^\uFEFF/, '')
    const lines = cleanContent.split(/\r?\n/).filter(line => line.trim())

    // Header
    const header = lines[0].split(',').map(h => h.trim())
    const boughtIdx = header.indexOf('boughtTimestamp')
    const soldIdx = header.indexOf('soldTimestamp')
    const pnlIdx = header.indexOf('pnl')
    const buyFillIdx = header.indexOf('buyFillId')
    const sellFillIdx = header.indexOf('sellFillId')

    const dailyPnl = {}
    let totalPnl = 0

    console.log(`Analyzing ${lines.length - 1} trades...`)

    for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim())

        const boughtTimestamp = values[boughtIdx]
        const soldTimestamp = values[soldIdx]
        const buyId = parseInt(values[buyFillIdx]) || 0
        const sellId = parseInt(values[sellFillIdx]) || 0

        // Determine Entry Time
        const isLong = buyId < sellId
        const boughtTime = parseTradovateTimestamp(boughtTimestamp)
        const soldTime = parseTradovateTimestamp(soldTimestamp)

        let entryTime = isLong ? boughtTime : soldTime

        // Validate
        if (entryTime.toString() === 'Invalid Date') {
            console.log(`Line ${i}: Invalid Date`)
            continue
        }

        const pnl = parsePnl(values[pnlIdx])
        totalPnl += pnl

        // Group by Day (Local String)
        const dayKey = entryTime.toDateString() // "Fri Dec 12 2025"

        if (!dailyPnl[dayKey]) dailyPnl[dayKey] = 0
        dailyPnl[dayKey] += pnl

        // Debug specific high value trades
        if (pnl > 300 || pnl < -300) {
            console.log(`High PnL Trade: $${pnl} on ${entryTime.toLocaleString()} (Line ${i + 1})`)
        }
    }

    console.log('\nDaily P&L (from CSV):')
    for (const [day, pnl] of Object.entries(dailyPnl)) {
        console.log(`${day}: $${pnl.toFixed(2)}`)
    }
    console.log(`\nTotal CSV P&L: $${totalPnl.toFixed(2)}`)
}

analyze()
