import { NextResponse } from "next/server"

import { getServerEnv } from "@/lib/server-env"

export async function GET() {
  const clientId = getServerEnv("SLACK_CLIENT_ID")
  const baseUrl = getServerEnv("NEXTAUTH_URL") || "http://localhost:3000"
  const redirectUri =
    getServerEnv("NEXT_PUBLIC_SLACK_REDIRECT_URI") ||
    `${baseUrl}/api/auth/slack/callback`

  if (!clientId || !redirectUri) {
    return NextResponse.json(
      { error: "Slack OAuth not configured" },
      { status: 500 }
    )
  }

  // Slack OAuth scopes for "Sign in with Slack"
  const scopes = ["openid", "profile", "email"]

  const slackAuthUrl = new URL("https://slack.com/openid/connect/authorize")
  slackAuthUrl.searchParams.set("client_id", clientId)
  slackAuthUrl.searchParams.set("scope", scopes.join(" "))
  slackAuthUrl.searchParams.set("redirect_uri", redirectUri)
  slackAuthUrl.searchParams.set("response_type", "code")
  slackAuthUrl.searchParams.set("nonce", crypto.randomUUID())

  return NextResponse.redirect(slackAuthUrl.toString())
}
