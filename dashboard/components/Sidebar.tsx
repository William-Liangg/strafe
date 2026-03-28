'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Bot,
  Ticket,
  BarChart3,
  GitBranch,
  Hash,
  Users,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAgentStatus } from '@/lib/hooks'

const navItems = [
  { href: '/', label: 'Agent', icon: Bot },
  { href: '/tickets', label: 'Tickets', icon: Ticket },
  { href: '/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/sprints', label: 'Sprints', icon: GitBranch },
  { href: '/channels', label: 'Channels', icon: Hash },
  { href: '/engineers', label: 'Engineers', icon: Users },
]

function AgentStatusIndicator() {
  const { data: agentStatus } = useAgentStatus()

  const getStatusColor = () => {
    if (!agentStatus) return 'bg-gray-500'
    switch (agentStatus.agent_status) {
      case 'active':
        return 'bg-green-500'
      case 'idle':
        return 'bg-yellow-500'
      case 'offline':
        return 'bg-red-500'
      default:
        return 'bg-gray-500'
    }
  }

  const getStatusLabel = () => {
    if (!agentStatus) return 'Loading...'
    switch (agentStatus.agent_status) {
      case 'active':
        return 'Agent active'
      case 'idle':
        return 'Agent idle'
      case 'offline':
        return 'Agent offline'
      default:
        return 'Unknown'
    }
  }

  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-[#1f1f1f]">
      <span className={cn('w-2 h-2 rounded-full animate-pulse', getStatusColor())} />
      <span className="text-xs text-gray-400">{getStatusLabel()}</span>
    </div>
  )
}

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="fixed left-0 top-0 bottom-0 w-[220px] bg-[#0a0a0a] border-r border-[#1f1f1f] flex flex-col">
      <div className="p-5">
        <h1 className="text-white text-xl font-bold">Strafe</h1>
        <p className="text-gray-500 text-sm">Sprint Intelligence</p>
      </div>

      <nav className="flex-1 px-3 py-4">
        <ul className="space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href
            const Icon = item.icon

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-white text-black'
                      : 'text-gray-400 hover:text-white hover:bg-[#1f1f1f]'
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      <div className="px-3 pb-3">
        <AgentStatusIndicator />
      </div>

      <div className="p-5 text-xs text-gray-600">
        Strafe v0.1 · YHacks 2026
      </div>
    </aside>
  )
}
