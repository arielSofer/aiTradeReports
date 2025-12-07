/**
 * TopstepX Trade Parser
 * Parses trades from TopstepX share stats page HTML
 * 
 * Supports multiple methods:
 * 1. DOM parsing of visible rows
 * 2. Regex parsing of HTML source
 * 3. JSON data extraction from script tags
 */

export interface TopstepXTrade {
  id: string
  symbol: string
  quantity: number
  entryTime: string // ISO string
  exitTime: string // ISO string
  duration: string
  entryPrice: number
  exitPrice: number
  pnl: number
  commission: number
  fees: number
  direction: 'long' | 'short'
}

/**
 * Parse date from TopstepX format
 * Example: "December 5 2025 @ 3:53:26 pm"
 */
function parseTopstepDate(dateStr: string): string {
  try {
    // Remove @ and clean up
    const cleaned = dateStr.replace(' @ ', ' ').trim()
    const date = new Date(cleaned)

    if (!isNaN(date.getTime())) {
      return date.toISOString()
    }

    // Try manual parsing
    const match = cleaned.match(/(\w+)\s+(\d+)\s+(\d+)\s+(\d+):(\d+):(\d+)\s*(am|pm)/i)
    if (match) {
      const [, month, day, year, hours, minutes, seconds, ampm] = match
      const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December']
      const monthIndex = monthNames.findIndex(m => m.toLowerCase() === month.toLowerCase())

      if (monthIndex === -1) {
        return new Date().toISOString()
      }

      let hour = parseInt(hours)
      if (ampm.toLowerCase() === 'pm' && hour !== 12) hour += 12
      if (ampm.toLowerCase() === 'am' && hour === 12) hour = 0

      const parsedDate = new Date(parseInt(year), monthIndex, parseInt(day), hour, parseInt(minutes), parseInt(seconds))
      return parsedDate.toISOString()
    }

    return new Date().toISOString()
  } catch (error) {
    console.error('Error parsing date:', dateStr, error)
    return new Date().toISOString()
  }
}

/**
 * Parse price from TopstepX format
 * Example: "25,599.25" or "47,664"
 */
function parsePrice(priceStr: string): number {
  try {
    return parseFloat(priceStr.replace(/,/g, ''))
  } catch {
    return 0
  }
}

/**
 * Parse P&L/fee from TopstepX format
 * Example: "$191.00" or "$-105.00"
 */
function parseMoney(moneyStr: string): number {
  try {
    const cleaned = moneyStr.replace(/[$,]/g, '')
    return parseFloat(cleaned)
  } catch {
    return 0
  }
}

/**
 * Try to extract JSON data from script tags
 */
function extractJsonData(html: string): any[] {
  const trades: any[] = []

  try {
    // Look for __NEXT_DATA__ or similar JSON structures
    const nextDataMatch = html.match(/__NEXT_DATA__\s*=\s*({[\s\S]+?});/)
    if (nextDataMatch) {
      try {
        const data = JSON.parse(nextDataMatch[1])
        // Navigate through the data structure to find trades
        if (data?.props?.pageProps?.trades) {
          return data.props.pageProps.trades
        }
        if (data?.props?.initialState?.trades) {
          return data.props.initialState.trades
        }
      } catch (e) {
        console.log('Could not parse __NEXT_DATA__:', e)
      }
    }

    // Look for window.__INITIAL_STATE__ or similar
    const initialStateMatch = html.match(/window\.__INITIAL_STATE__\s*=\s*({[\s\S]+?});/)
    if (initialStateMatch) {
      try {
        const data = JSON.parse(initialStateMatch[1])
        if (data?.trades) {
          return data.trades
        }
      } catch (e) {
        console.log('Could not parse __INITIAL_STATE__:', e)
      }
    }
  } catch (error) {
    console.log('Error extracting JSON data:', error)
  }

  return trades
}

/**
 * Parse trades from TopstepX HTML using regex (more reliable for full page source)
 */
function parseWithRegex(html: string): TopstepXTrade[] {
  const trades: TopstepXTrade[] = []

  // Match each row - look for data-id attribute
  const rowRegex = /<div[^>]*data-id="(\d+)"[^>]*data-rowindex="\d+"[^>]*role="row"[^>]*class="[^"]*MuiDataGrid-row[^"]*"[^>]*>([\s\S]*?)<\/div>(?=\s*<div[^>]*data-id="|\s*<\/div>)/g

  let rowMatch
  while ((rowMatch = rowRegex.exec(html)) !== null) {
    try {
      const trade: TopstepXTrade = {
        id: rowMatch[1],
        symbol: '',
        quantity: 0,
        entryTime: '',
        exitTime: '',
        duration: '',
        entryPrice: 0,
        exitPrice: 0,
        pnl: 0,
        commission: 0,
        fees: 0,
        direction: 'long'
      }

      const rowHtml = rowMatch[2]

      // Extract symbol - look for span inside symbolName cell
      const symbolMatch = rowHtml.match(/data-field="symbolName"[^>]*>[\s\S]*?<span[^>]*>([^<]+)<\/span>/i)
      if (symbolMatch) trade.symbol = symbolMatch[1].trim()

      // Extract quantity
      const qtyMatch = rowHtml.match(/data-field="positionSize"[^>]*>[\s\S]*?<span[^>]*>(\d+)<\/span>/i)
      if (qtyMatch) trade.quantity = parseInt(qtyMatch[1])

      // Extract entry time
      const entryTimeMatch = rowHtml.match(/data-field="entryTime"[^>]*>[\s\S]*?<span[^>]*>([^<]+)<\/span>/i)
      if (entryTimeMatch) trade.entryTime = parseTopstepDate(entryTimeMatch[1].trim())

      // Extract exit time
      const exitTimeMatch = rowHtml.match(/data-field="exitedAt"[^>]*>[\s\S]*?<span[^>]*>([^<]+)<\/span>/i)
      if (exitTimeMatch) trade.exitTime = parseTopstepDate(exitTimeMatch[1].trim())

      // Extract duration
      const durationMatch = rowHtml.match(/data-field="tradeDurationDisplay"[^>]*>[\s\S]*?<span[^>]*>([^<]+)<\/span>/i)
      if (durationMatch) trade.duration = durationMatch[1].trim()

      // Extract entry price - look for numbers with commas
      const entryPriceMatch = rowHtml.match(/data-field="entryPrice"[^>]*>[\s\S]*?<span[^>]*>([0-9,.]+)<\/span>/i)
      if (entryPriceMatch) trade.entryPrice = parsePrice(entryPriceMatch[1])

      // Extract exit price
      const exitPriceMatch = rowHtml.match(/data-field="exitPrice"[^>]*>[\s\S]*?<span[^>]*>([0-9,.]+)<\/span>/i)
      if (exitPriceMatch) trade.exitPrice = parsePrice(exitPriceMatch[1])

      // Extract P&L - look for $ sign
      const pnlMatch = rowHtml.match(/data-field="pnL"[^>]*>[\s\S]*?<span[^>]*>\$?([-0-9,.]+)<\/span>/i)
      if (pnlMatch) trade.pnl = parseMoney(pnlMatch[1])

      // Extract commission
      const commMatch = rowHtml.match(/data-field="commisions"[^>]*>[\s\S]*?<span[^>]*>\$?([-0-9,.]+)<\/span>/i)
      if (commMatch) trade.commission = Math.abs(parseMoney(commMatch[1]))

      // Extract fees
      const feesMatch = rowHtml.match(/data-field="fees"[^>]*>[\s\S]*?<span[^>]*>\$?([-0-9,.]+)<\/span>/i)
      if (feesMatch) trade.fees = Math.abs(parseMoney(feesMatch[1]))

      // Extract direction
      const dirMatch = rowHtml.match(/data-field="direction"[^>]*>([^<]*(?:Long|Short)[^<]*)/i)
      if (dirMatch) {
        const dirText = dirMatch[1].toLowerCase()
        trade.direction = dirText.includes('long') ? 'long' : 'short'
      }

      // Only add if we have valid data (at least ID and symbol)
      if (trade.id && trade.symbol) {
        trades.push(trade)
      }
    } catch (error) {
      console.error('Error parsing row with regex:', error)
    }
  }

  return trades
}

/**
 * Parse trades from TopstepX HTML
 * Tries multiple methods to get all trades
 */
export function parseTopstepXHtml(html: string): TopstepXTrade[] {
  let trades: TopstepXTrade[] = []

  console.log('Parsing HTML, length:', html.length)

  // Method 1: Try DOM parsing (for visible rows)
  try {
    const parser = new DOMParser()
    const doc = parser.parseFromString(html, 'text/html')

    const rows = doc.querySelectorAll('.MuiDataGrid-row')
    console.log('Found', rows.length, 'rows via DOM')

    rows.forEach(row => {
      try {
        const trade: TopstepXTrade = {
          id: '',
          symbol: '',
          quantity: 0,
          entryTime: '',
          exitTime: '',
          duration: '',
          entryPrice: 0,
          exitPrice: 0,
          pnl: 0,
          commission: 0,
          fees: 0,
          direction: 'long'
        }

        trade.id = row.getAttribute('data-id') || ''

        const cells = row.querySelectorAll('.MuiDataGrid-cell')

        cells.forEach(cell => {
          const field = cell.getAttribute('data-field')
          const content = cell.textContent?.trim() || ''

          switch (field) {
            case 'symbolName':
              trade.symbol = content
              break
            case 'positionSize':
              trade.quantity = parseInt(content) || 0
              break
            case 'entryTime':
              trade.entryTime = parseTopstepDate(content)
              break
            case 'exitedAt':
              trade.exitTime = parseTopstepDate(content)
              break
            case 'tradeDurationDisplay':
              trade.duration = content
              break
            case 'entryPrice':
              trade.entryPrice = parsePrice(content)
              break
            case 'exitPrice':
              trade.exitPrice = parsePrice(content)
              break
            case 'pnL':
              trade.pnl = parseMoney(content)
              break
            case 'commisions':
              trade.commission = Math.abs(parseMoney(content))
              break
            case 'fees':
              trade.fees = Math.abs(parseMoney(content))
              break
            case 'direction':
              trade.direction = content.toLowerCase() === 'long' ? 'long' : 'short'
              break
          }
        })

        if (trade.id && trade.symbol) {
          trades.push(trade)
        }
      } catch (error) {
        console.error('Error parsing row:', error)
      }
    })
  } catch (error) {
    console.error('Error in DOM parsing:', error)
  }

  // Method 2: If DOM parsing didn't find enough, try regex (works on full HTML source)
  if (trades.length < 10) {
    console.log('Trying regex parsing...')
    const regexTrades = parseWithRegex(html)
    console.log('Found', regexTrades.length, 'trades via regex')

    // Merge results, avoiding duplicates
    const existingIds = new Set(trades.map(t => t.id))
    regexTrades.forEach(t => {
      if (!existingIds.has(t.id)) {
        trades.push(t)
      }
    })
  }

  // Method 3: Try to extract from JSON data
  if (trades.length < 10) {
    console.log('Trying JSON extraction...')
    const jsonTrades = extractJsonData(html)
    if (jsonTrades.length > 0) {
      console.log('Found', jsonTrades.length, 'trades in JSON')
      // Transform JSON trades to our format
      // (This would need to match TopstepX's JSON structure)
    }
  }

  // Remove duplicates by ID
  const uniqueTrades = new Map<string, TopstepXTrade>()
  trades.forEach(trade => {
    if (trade.id && !uniqueTrades.has(trade.id)) {
      uniqueTrades.set(trade.id, trade)
    }
  })

  const finalTrades = Array.from(uniqueTrades.values())
  console.log('Final trades count:', finalTrades.length)

  return finalTrades
}

/**
 * Parse trades from raw HTML string (alias for compatibility)
 */
export function parseTopstepXHtmlWithRegex(html: string): TopstepXTrade[] {
  return parseTopstepXHtml(html)
}

/**
 * Convert TopstepX trades to our unified trade format
 */
export function convertTopstepXTrades(trades: TopstepXTrade[]): any[] {
  return trades.map(trade => ({
    externalId: `topstepx-${trade.id}`,
    symbol: trade.symbol,
    direction: trade.direction,
    status: 'closed' as const,
    entryTime: trade.entryTime,
    exitTime: trade.exitTime,
    entryPrice: trade.entryPrice,
    exitPrice: trade.exitPrice,
    quantity: trade.quantity,
    commission: trade.commission + trade.fees,
    pnlNet: trade.pnl - trade.fees,
    pnlPercent: trade.entryPrice > 0
      ? ((trade.exitPrice - trade.entryPrice) / trade.entryPrice) * 100 * (trade.direction === 'long' ? 1 : -1)
      : 0,
    tags: ['TopstepX'],
    notes: `Duration: ${trade.duration}`,
  }))
}

/**
 * Extract share ID from TopstepX URL
 */
export function extractShareId(url: string): string | null {
  try {
    const urlObj = new URL(url)
    return urlObj.searchParams.get('share')
  } catch {
    // Try regex fallback
    const match = url.match(/share=(\d+)/)
    return match ? match[1] : null
  }
}

/**
 * Validate TopstepX URL
 */
export function isValidTopstepXUrl(url: string): boolean {
  try {
    const urlObj = new URL(url)
    return urlObj.hostname.includes('topstepx.com') && urlObj.searchParams.has('share')
  } catch {
    return false
  }
}
