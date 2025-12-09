import { NextRequest, NextResponse } from 'next/server'
import { chromium } from 'playwright'

/**
 * API Route to fetch TopstepX share page using Playwright
 * This handles dynamic JS-loaded content
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const shareId = searchParams.get('share')

  if (!shareId) {
    return NextResponse.json(
      { error: 'Missing share parameter' },
      { status: 400 }
    )
  }

  let browser = null

  try {
    const url = `https://topstepx.com/share/stats?share=${shareId}`
    console.log(`Scraping URL with Playwright: ${url}`)

    // Launch headless browser
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'] // Required for some environments
    })

    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    })

    const page = await context.newPage()

    // Navigate and wait for network to be idle (heuristics for SPA load)
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 })

    // Wait for the grid rows to appear - selector based on previous DOM analysis
    try {
      await page.waitForSelector('.MuiDataGrid-row', { timeout: 10000 })
      console.log('Trade rows found')
    } catch (e) {
      console.log('Timeout waiting for rows, continuing with whatever loaded...')
    }

    // Get full HTML
    const html = await page.content()

    return NextResponse.json({ html, url })

  } catch (error) {
    console.error('Error in Playwright scraper:', error)
    return NextResponse.json(
      { error: 'Failed to scrape TopstepX page', details: String(error) },
      { status: 500 }
    )
  } finally {
    if (browser) {
      await browser.close()
    }
  }
}

