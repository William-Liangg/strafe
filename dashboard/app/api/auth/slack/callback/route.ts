import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"

import { getServerEnv } from "@/lib/server-env"

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const code = searchParams.get("code")
  const error = searchParams.get("error")

  if (error) {
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(error)}`, request.url)
    )
  }

  if (!code) {
    return NextResponse.redirect(
      new URL("/login?error=no_code", request.url)
    )
  }

  const clientId = getServerEnv("SLACK_CLIENT_ID")
  const clientSecret = getServerEnv("SLACK_CLIENT_SECRET")
  const redirectUri =
    getServerEnv("NEXT_PUBLIC_SLACK_REDIRECT_URI") ||
    `${getServerEnv("NEXTAUTH_URL") || request.nextUrl.origin}/api/auth/slack/callback`

  if (!clientId || !clientSecret || !redirectUri) {
    return NextResponse.redirect(
      new URL("/login?error=not_configured", request.url)
    )
  }

  try {
    // Exchange code for token
    const tokenResponse = await fetch("https://slack.com/api/openid.connect.token", {
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

    if (!tokenData.ok) {
      console.error("Slack token error:", tokenData)
      return NextResponse.redirect(
        new URL(`/login?error=${encodeURIComponent(tokenData.error || "token_error")}`, request.url)
      )
    }

    // Get user info from Slack
    const userResponse = await fetch("https://slack.com/api/openid.connect.userInfo", {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
      },
    })

    const userData = await userResponse.json()

    if (!userData.ok) {
      console.error("Slack userinfo error:", userData)
      return NextResponse.redirect(
        new URL("/login?error=userinfo_error", request.url)
      )
    }

    // Create session data
    const session = {
      user: {
        id: userData.sub,
        email: userData.email,
        name: userData.name,
        picture: userData.picture,
        team: userData["https://slack.com/team_name"],
      },
      accessToken: tokenData.access_token,
      expiresAt: Date.now() + (tokenData.expires_in || 43200) * 1000,
    }

    // Set session cookie
    const cookieStore = await cookies()
    cookieStore.set("session", JSON.stringify(session), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 1 week
      path: "/",
    })

    // Redirect to dashboard
    return NextResponse.redirect(new URL("/", request.url))
  } catch (err) {
    console.error("Slack OAuth error:", err)
    return NextResponse.redirect(
      new URL("/login?error=oauth_error", request.url)
    )
  }
}
