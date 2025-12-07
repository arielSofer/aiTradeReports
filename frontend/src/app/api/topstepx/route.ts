import { NextRequest, NextResponse } from 'next/server'

/**
 * API Route to fetch TopstepX share page
 * This avoids CORS issues when fetching from the client
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
  
  try {
    const url = `https://topstepx.com/share/stats?share=${shareId}`
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      next: { revalidate: 0 } // Don't cache
    })
    
    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to fetch TopstepX page: ${response.status}` },
        { status: response.status }
      )
    }
    
    const html = await response.text()
    
    return NextResponse.json({ html, url })
  } catch (error) {
    console.error('Error fetching TopstepX:', error)
    return NextResponse.json(
      { error: 'Failed to fetch TopstepX page' },
      { status: 500 }
    )
  }
}

