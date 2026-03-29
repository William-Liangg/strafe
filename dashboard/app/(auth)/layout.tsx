import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './auth.css'

const geist = Geist({
  subsets: ['latin'],
  variable: '--font-geist-sans'
})

const geistMono = Geist_Mono({
  subsets: ['latin'],
  variable: '--font-geist-mono'
})

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
    <html lang="en" className={`${geist.variable} ${geistMono.variable} dark`}>
      <body className="font-sans antialiased">
        {children}
      </body>
    </html>
  )
}
