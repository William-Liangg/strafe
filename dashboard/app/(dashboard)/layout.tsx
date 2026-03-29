import type { Metadata } from "next";
import { Manrope, Inter } from "next/font/google";
import "../globals.css";
import { Sidebar } from "@/components/Sidebar";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
})

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  title: "Strafe - Sprint Intelligence",
  description: "Track adhoc work and analyze sprint health",
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${manrope.variable} ${inter.variable}`}>
      <body className="min-h-full bg-[#f9faf0] text-[#2d3526]">
        <Sidebar />
        <div className="ml-64">{children}</div>
      </body>
    </html>
  )
}
