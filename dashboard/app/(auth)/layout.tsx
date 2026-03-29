import type { Metadata } from 'next'
import './auth.css'

export const metadata: Metadata = {
  title: 'Sign in — Strafe',
  description: 'Sign in to your Strafe account',
}

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      {children}
    </div>
  )
}
