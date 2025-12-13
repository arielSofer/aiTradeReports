import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

const allowedOrigins = new Set([
  'https://trade-d720f.web.app',
  'https://trade-d720f.firebaseapp.com',
  'https://ai-trade-reports-jx6ncw912-arielvdcr-gmailcoms-projects.vercel.app',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
])

function corsHeaders(origin: string | null) {
  const headers = new Headers()
  if (origin && allowedOrigins.has(origin)) {
    headers.set('Access-Control-Allow-Origin', origin)
  }
  headers.set('Access-Control-Allow-Credentials', 'true')
  headers.set('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS')
  headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  return headers
}

export function middleware(req: NextRequest) {
  const origin = req.headers.get('origin')
  if (req.method === 'OPTIONS') {
    return new NextResponse(null, {
      status: 204,
      headers: corsHeaders(origin),
    })
  }

  const response = NextResponse.next()
  const headers = corsHeaders(origin)
  headers.forEach((value, key) => response.headers.set(key, value))
  return response
}

export const config = {
  matcher: ['/api/:path*'],
}



