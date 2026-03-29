'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Bot, Ticket, Users, GitBranch, Plug2 } from 'lucide-react'
import { IntegrationsModal } from './IntegrationsModal'

const navItems = [
  { href: '/', label: 'Live Feed', Icon: Bot },
  { href: '/tickets', label: 'Tickets', Icon: Ticket },
  { href: '/engineers', label: 'Engineers', Icon: Users },
  { href: '/expertise', label: 'Expertise', Icon: GitBranch },
]

export function Sidebar() {
  const pathname = usePathname()
  const [integrationsOpen, setIntegrationsOpen] = useState(false)
  const [demoMode, setDemoMode] = useState(false)
  const [togglingDemo, setTogglingDemo] = useState(false)

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDemoMode(document.cookie.split('; ').some((cookie) => cookie === 'demo_mode=true'))
    }, 0)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [])

  const handleDemoToggle = async () => {
    const nextValue = !demoMode
    setDemoMode(nextValue)
    setTogglingDemo(true)

    try {
      await fetch('/api/demo-toggle', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ demo: nextValue }),
      })

      window.location.reload()
    } catch (error) {
      console.error('Failed to toggle demo mode:', error)
      setDemoMode(!nextValue)
      setTogglingDemo(false)
    }
  }

  return (
    <>
      <aside
        className="fixed left-0 top-0 h-full w-64 bg-[#ebf0e0] z-50 flex flex-col p-5"
        style={{ fontFamily: 'var(--font-manrope)' }}
      >
        <div className="mb-8 px-3 pt-2">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-[#2d3526]">Strafe</h1>
            {demoMode && (
              <span className="rounded-md bg-[#9f403d] px-1 py-0.5 text-[10px] font-black text-white">
                DEMO
              </span>
            )}
          </div>
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

        <button
          onClick={() => setIntegrationsOpen(true)}
          className="flex items-center gap-3 px-4 py-2 text-[#757d6b] hover:text-[#2d3526] transition-colors text-sm"
        >
          <Plug2 className="h-4 w-4" />
          <span>Integrations</span>
        </button>

        <div className="mt-4 px-4">
          <div className="mb-2 text-xs font-bold uppercase tracking-widest text-[#757d6b]">
            Demo Mode
          </div>
          <button
            onClick={handleDemoToggle}
            disabled={togglingDemo}
            className="flex w-full items-center justify-between rounded-2xl bg-white/80 px-3 py-3 text-left transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            <span className="text-sm font-medium text-[#2d3526]">
              {demoMode ? 'Using seeded demo data' : 'Using live backend'}
            </span>
            <span
              className={[
                'relative inline-flex h-6 w-11 items-center rounded-full border transition-colors',
                demoMode
                  ? 'border-[#9D70FF] bg-[#9D70FF]'
                  : 'border-[#b8c4a8] bg-transparent',
              ].join(' ')}
            >
              <span
                className={[
                  'inline-block h-4 w-4 rounded-full bg-white transition-transform',
                  demoMode ? 'translate-x-6' : 'translate-x-1',
                ].join(' ')}
              />
            </span>
          </button>
        </div>

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

      <IntegrationsModal
        isOpen={integrationsOpen}
        onClose={() => setIntegrationsOpen(false)}
      />
    </>
  )
}
