import { NextResponse } from "next/server"

export async function GET() {
  const clientId = process.env.SLACK_CLIENT_ID

  if (!clientId) {
    return NextResponse.json(
      { error: "Slack OAuth not configured" },
      { status: 500 }
    )
  }

  const redirectUri = process.env.NEXT_PUBLIC_SLACK_REDIRECT_URI!

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
