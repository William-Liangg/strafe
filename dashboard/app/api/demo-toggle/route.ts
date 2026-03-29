import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as { demo?: boolean }
  const response = NextResponse.json({ success: true })

  if (body.demo) {
    response.cookies.set('demo_mode', 'true', {
      path: '/',
      maxAge: 86400,
    })
  } else {
    response.cookies.set('demo_mode', '', {
      path: '/',
      maxAge: 0,
    })
  }

  return response
}
