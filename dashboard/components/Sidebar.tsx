'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Bot, Ticket, Users } from 'lucide-react'

const navItems = [
  { href: '/', label: 'Live Feed', Icon: Bot },
  { href: '/tickets', label: 'Tickets', Icon: Ticket },
  { href: '/engineers', label: 'Engineers', Icon: Users },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside
      className="fixed left-0 top-0 h-full w-64 bg-[#ebf0e0] z-50 flex flex-col p-5"
      style={{ fontFamily: 'var(--font-manrope)' }}
    >
      <div className="mb-8 px-3 pt-2">
        <h1 className="text-2xl font-bold tracking-tight text-[#2d3526]">Strafe</h1>
        <p className="text-xs text-[#757d6b] mt-0.5">V1.0.4</p>
      </div>

      <nav className="flex-1 flex flex-col gap-1">
        {navItems.map(({ href, label, Icon }) => {
          const isActive = pathname === href
          return (
            <Link
              key={href}
              href={href}
              className={
                isActive
                  ? 'flex items-center gap-3 px-4 py-3 rounded-2xl text-white font-semibold text-sm transition-all'
                  : 'flex items-center gap-3 px-4 py-3 rounded-2xl text-[#757d6b] hover:text-[#2d3526] hover:bg-white text-sm font-medium transition-all'
              }
              style={isActive ? { background: 'linear-gradient(180deg, #5f5e5e 0%, #535252 100%)' } : {}}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span>{label}</span>
            </Link>
          )
        })}
      </nav>

      <div className="mt-auto pt-4 flex items-center gap-3 px-3">
        <div className="w-9 h-9 shrink-0 rounded-xl bg-[#d8e2c8] flex items-center justify-center font-semibold text-[#2d3526] text-sm">
          MP
        </div>
        <div className="flex flex-col min-w-0">
          <span className="text-sm font-semibold text-[#2d3526] truncate">Maya Patel</span>
          <span className="text-xs text-[#757d6b]">Lead Architect</span>
        </div>
      </div>
    </aside>
  )
}
