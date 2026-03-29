'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Bot, Ticket, BarChart3, FileText, Hash, Users } from 'lucide-react'

import { CURRENT_USER } from '@/lib/user'

const navItems = [
  { href: '/', label: 'Live Feed', Icon: Bot },
  { href: '/tickets', label: 'Tickets', Icon: Ticket },
  { href: '/analytics', label: 'Analytics', Icon: BarChart3 },
  { href: '/report', label: 'Sprint Report', Icon: FileText },
  { href: '/channels', label: 'Channels', Icon: Hash },
  { href: '/engineers', label: 'Engineers', Icon: Users },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside
      className="fixed left-0 top-0 h-full w-64 border-r-4 border-black bg-slate-900 z-50 flex flex-col p-4 gap-2 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
      style={{ fontFamily: 'var(--font-space-grotesk)' }}
    >
      <div className="mb-8 p-2 border-b-2 border-white/10">
        <h1 className="text-2xl font-black tracking-tighter text-white">Strafe</h1>
        <p className="text-xs text-slate-400 font-medium">V1.0.4</p>
      </div>

      <nav className="flex-1 flex flex-col gap-2">
        {navItems.map(({ href, label, Icon }) => {
          const isActive = pathname === href
          return (
            <Link
              key={href}
              href={href}
              className={
                isActive
                  ? 'flex items-center gap-3 px-4 py-3 bg-violet-600 text-black border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] font-bold transition-transform hover:translate-x-1 hover:-translate-y-1'
                  : 'flex items-center gap-3 px-4 py-3 text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-all hover:translate-x-1 hover:-translate-y-1'
              }
            >
              <Icon className="h-5 w-5 shrink-0" />
              <span>{label}</span>
            </Link>
          )
        })}
      </nav>

      <div className="mt-auto pt-4 border-t-2 border-white/10 flex items-center gap-3">
        <div className={`w-10 h-10 shrink-0 border-2 border-black ${CURRENT_USER.color} flex items-center justify-center font-black text-black text-sm`}>
          {CURRENT_USER.initials}
        </div>
        <div className="flex flex-col min-w-0">
          <span className="text-sm font-bold text-white truncate">{CURRENT_USER.name}</span>
          <span className="text-xs text-slate-400">{CURRENT_USER.role}</span>
        </div>
      </div>
    </aside>
  )
}
