import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const code = searchParams.get("code")
  const error = searchParams.get("error")

  // Base URL for redirects - use the request origin to stay on the same host
  const baseUrl = request.nextUrl.origin

  if (error) {
    console.error("Google OAuth error:", error)
    return NextResponse.redirect(
      new URL(`/?integration_error=${encodeURIComponent(error)}`, baseUrl)
    )
  }

  if (!code) {
    return NextResponse.redirect(
      new URL("/?integration_error=no_code", baseUrl)
    )
  }

  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  const redirectUri = process.env.GOOGLE_REDIRECT_URI

  if (!clientId || !clientSecret || !redirectUri) {
    console.error("Google OAuth not configured")
    return NextResponse.redirect(
      new URL("/?integration_error=not_configured", baseUrl)
    )
  }

  try {
    // Exchange code for tokens
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    })

    const tokenData = await tokenResponse.json()

    if (tokenData.error) {
      console.error("Google token error:", tokenData)
      return NextResponse.redirect(
        new URL(`/?integration_error=${encodeURIComponent(tokenData.error)}`, baseUrl)
      )
    }

    // Get user info to display email
    const userResponse = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
      },
    })

    const userData = await userResponse.json()

    // Store the Google Calendar token in a cookie
    // In production, you'd store this in a database
    const googleCalendarData = {
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      expires_at: Date.now() + (tokenData.expires_in || 3600) * 1000,
      email: userData.email,
    }

    const cookieStore = await cookies()
    cookieStore.set("google_calendar", JSON.stringify(googleCalendarData), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: "/",
    })

    // Redirect back to dashboard with success
    return NextResponse.redirect(
      new URL("/?integration_success=google_calendar", baseUrl)
    )
  } catch (err) {
    console.error("Google OAuth error:", err)
    return NextResponse.redirect(
      new URL("/?integration_error=oauth_error", baseUrl)
    )
  }
}
