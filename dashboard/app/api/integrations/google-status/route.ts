import { NextResponse } from "next/server"
import { cookies } from "next/headers"

export async function GET() {
  const cookieStore = await cookies()
  const googleCalendarCookie = cookieStore.get("google_calendar")

  if (!googleCalendarCookie?.value) {
    return NextResponse.json({
      connected: false,
    })
  }

  try {
    const data = JSON.parse(googleCalendarCookie.value)

    // Check if token is expired
    if (data.expires_at && data.expires_at < Date.now()) {
      // Token expired - in production you'd refresh it here
      return NextResponse.json({
        connected: false,
        reason: "token_expired",
      })
    }

    return NextResponse.json({
      connected: true,
      email: data.email,
    })
  } catch {
    return NextResponse.json({
      connected: false,
    })
  }
}

export async function DELETE() {
  const cookieStore = await cookies()
  cookieStore.delete("google_calendar")

  return NextResponse.json({
    success: true,
    message: "Disconnected Google Calendar",
  })
}
