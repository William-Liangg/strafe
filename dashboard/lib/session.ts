import { cookies } from "next/headers"

export interface User {
  id: string
  email: string
  name: string
  picture?: string
  team?: string
}

export interface Session {
  user: User
  accessToken: string
  expiresAt: number
}

export async function getSession(): Promise<Session | null> {
  const cookieStore = await cookies()
  const sessionCookie = cookieStore.get("session")

  if (!sessionCookie?.value) {
    return null
  }

  try {
    const session = JSON.parse(sessionCookie.value) as Session

    // Check if session is expired
    if (session.expiresAt < Date.now()) {
      return null
    }

    return session
  } catch {
    return null
  }
}

export async function getUser(): Promise<User | null> {
  const session = await getSession()
  return session?.user ?? null
}
