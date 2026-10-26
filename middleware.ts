import { NextRequest, NextResponse } from 'next/server'

// The browsing pages show our own tags and summaries, so they sit behind a password (VIEW_PASSWORD
// in Vercel; any user name). The pipeline routes under /api have their own key and are not affected.
export function middleware(req: NextRequest) {
  const password = process.env.VIEW_PASSWORD
  if (!password) return new NextResponse('Set VIEW_PASSWORD in Vercel to open the feed.', { status: 503 })
  const header = req.headers.get('authorization') || ''
  const [scheme, encoded] = header.split(' ')
  if (scheme === 'Basic' && encoded) {
    const decoded = atob(encoded)
    if (decoded.slice(decoded.indexOf(':') + 1) === password) return NextResponse.next()
  }
  return new NextResponse('Password required', { status: 401, headers: { 'WWW-Authenticate': 'Basic realm="AM Intelligence"' } })
}

export const config = { matcher: ['/feed/:path*', '/judge/:path*', '/api/cj/human'] }
