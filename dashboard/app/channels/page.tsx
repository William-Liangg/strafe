'use client'

import { useState, useEffect } from 'react'
import {
  BarChart3, Hash, AlertTriangle, MoreVertical,
  Search, Zap, Shield, Plus, Filter,
} from 'lucide-react'
import { useChannels } from '@/lib/hooks'

const API_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8000'

// ─── types ───────────────────────────────────────────────────────────────────

interface ChannelConfig {
  channel_id: string
  channel_name: string | null
  workspace_id: string
  sensitivity: number
  monitoring_active: boolean
  min_replies: number
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function stripHash(s: string | null | undefined) {
  return (s ?? '').replace(/^#+/, '')
}

function sensitivityLevel(s: number): 'high' | 'medium' | 'low' {
  if (s >= 0.8) return 'high'
  if (s >= 0.5) return 'medium'
  return 'low'
}

function sensitivityBadge(level: 'high' | 'medium' | 'low') {
  switch (level) {
    case 'high': return 'bg-[#ff6e84]/20 text-[#ff6e84] border border-[#ff6e84]'
    case 'medium': return 'bg-[#bd9dff]/20 text-[#bd9dff] border border-[#bd9dff]'
    case 'low': return 'bg-[#6d758c]/20 text-[#6d758c] border border-[#6d758c]'
  }
}

const BAR_COLORS = [
  'bg-[#bd9dff]', 'bg-[#d1c4ff]', 'bg-[#a88cfb]',
  'bg-[#6d758c]', 'bg-[#40485d]',
]

// ─── skeletons / errors ───────────────────────────────────────────────────────

function PageSkeleton() {
  return (
    <div className="p-8 space-y-6">
      {[1, 2, 3].map((i) => (
        <div key={i} className="animate-pulse bg-[#141f38] border-2 border-black h-32" />
      ))}
    </div>
  )
}

function PageError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="p-8">
      <div className="bg-[#a70138] border-2 border-black p-4 flex items-center gap-3">
        <AlertTriangle className="h-5 w-5 text-[#ffb2b9] shrink-0" />
        <p className="flex-1 text-[#ffb2b9] font-medium">{message}</p>
        <button
          onClick={onRetry}
          className="bg-[#ff6e84] text-[#490013] px-4 py-2 border-2 border-black font-black shadow-[2px_2px_0px_0px_#000]"
          style={{ fontFamily: 'var(--font-space-grotesk)' }}
        >
          Retry
        </button>
      </div>
    </div>
  )
}

// ─── monitoring toggle (functional — calls PATCH /channels/:id) ───────────────

function MonitoringToggle({
  active,
  channelId,
  onChange,
}: {
  active: boolean
  channelId: string
  onChange: (v: boolean) => void
}) {
  const [busy, setBusy] = useState(false)

  const toggle = async () => {
    setBusy(true)
    try {
      const res = await fetch(`${API_URL}/channels/${channelId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ monitoring_active: !active }),
      })
      if (res.ok) onChange(!active)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={toggle}
        disabled={busy}
        className={`relative w-10 h-5 border-2 border-black transition-colors disabled:opacity-50 ${
          active ? 'bg-[#bd9dff]' : 'bg-[#192540]'
        }`}
        aria-label={active ? 'Disable monitoring' : 'Enable monitoring'}
      >
        <span
          className={`absolute top-[2px] w-[12px] h-[12px] transition-all duration-150 ${
            active ? 'left-[22px] bg-black' : 'left-[2px] bg-[#6d758c]'
          }`}
        />
      </button>
      <span
        className={`text-[10px] font-black uppercase tracking-wider ${
          active ? 'text-[#bd9dff]' : 'text-[#6d758c]'
        }`}
        style={{ fontFamily: 'var(--font-space-grotesk)' }}
      >
        {active ? 'Active' : 'Disabled'}
      </span>
    </div>
  )
}

// ─── page ─────────────────────────────────────────────────────────────────────

export default function ChannelsPage() {
  const [configs, setConfigs] = useState<ChannelConfig[]>([])
  const [configsLoading, setConfigsLoading] = useState(true)
  const [configsError, setConfigsError] = useState<string | null>(null)
  const [fetchTick, setFetchTick] = useState(0)
  const [searchQuery, setSearchQuery] = useState('')

  const { data: analyticsData, error: analyticsError, mutate: mutateAnalytics } = useChannels({ since_days: 30 })

  // Fetch channel configs
  useEffect(() => {
    let cancelled = false
    setConfigsLoading(true)
    setConfigsError(null)

    async function load() {
      try {
        const res = await fetch(`${API_URL}/channels/`)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data: ChannelConfig[] = await res.json()
        if (!cancelled) setConfigs(data)
      } catch (err) {
        if (!cancelled)
          setConfigsError(err instanceof Error ? err.message : 'Failed to load channels')
      } finally {
        if (!cancelled) setConfigsLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [fetchTick])

  const retry = () => {
    setFetchTick((t) => t + 1)
    mutateAnalytics()
  }

  const isLoading = configsLoading || (!analyticsData && !analyticsError)
  const hasError = (!!configsError && !configsLoading) || (!!analyticsError && !analyticsData)

  if (isLoading) return <PageSkeleton />
  if (hasError) return <PageError message="Failed to load channel data" onRetry={retry} />

  const analyticsChannels = analyticsData?.channels ?? []
  const maxCount = Math.max(...analyticsChannels.map((c) => c.count), 1)
  const analyticsMap = new Map(
    analyticsChannels.map((c) => [stripHash(c.channel_name).toLowerCase(), c])
  )

  const disabledChannels = configs.filter((c) => !c.monitoring_active)
  const firstDisabled = disabledChannels[0]

  const filteredConfigs = configs.filter((c) => {
    const name = stripHash(c.channel_name ?? c.channel_id).toLowerCase()
    return name.includes(searchQuery.toLowerCase())
  })

  const updateConfig = (id: string, patch: Partial<ChannelConfig>) =>
    setConfigs((prev) => prev.map((c) => (c.channel_id === id ? { ...c, ...patch } : c)))

  return (
    <div className="flex flex-col min-h-screen bg-[#060e20]">

      {/* ── Sticky header ── */}
      <header className="sticky top-0 z-30 border-b-4 border-black bg-slate-900/80 backdrop-blur-md flex justify-between items-center px-8 py-4 shadow-[0px_4px_0px_0px_rgba(0,0,0,1)]">
        <span
          className="text-3xl font-black italic tracking-tighter text-slate-50"
          style={{ fontFamily: 'var(--font-space-grotesk)' }}
        >
          Channels
        </span>
        <button
          onClick={retry}
          className="bg-[#bd9dff] text-black px-4 py-2 font-black border-2 border-black shadow-[2px_2px_0px_0px_#000] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none transition-all"
          style={{ fontFamily: 'var(--font-space-grotesk)' }}
        >
          Simulate Slack Event
        </button>
      </header>

      <main className="flex-1 p-8 space-y-8">

        {/* ── Top: two summary cards ── */}
        <div className="grid grid-cols-2 gap-8">

          {/* Card 1 — Ticket Distribution */}
          <div
            className="relative bg-[#0f1930] border-4 border-black p-6 overflow-hidden"
            style={{ boxShadow: '4px 4px 0px 0px #000' }}
          >
            <div className="absolute top-0 left-0 w-[3px] h-full bg-[#8a4cfc]" />
            <div
              className="absolute inset-0 pointer-events-none"
              style={{ background: 'linear-gradient(45deg, rgba(189,157,255,0.05) 0%, rgba(255,255,255,0) 100%)' }}
            />
            <div className="flex items-center gap-2 mb-5 pl-4">
              <BarChart3 className="h-5 w-5 text-[#bd9dff]" />
              <h3
                className="font-black uppercase text-sm text-white"
                style={{ fontFamily: 'var(--font-space-grotesk)' }}
              >
                Ticket Distribution by Channel
              </h3>
            </div>

            {analyticsChannels.length === 0 ? (
              <p className="text-[#6d758c] text-sm pl-4">No analytics data yet</p>
            ) : (
              <div className="space-y-4 pl-4">
                {analyticsChannels.slice(0, 6).map((ch, i) => (
                  <div key={ch.channel_name}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-bold text-[#bd9dff]">
                        #{stripHash(ch.channel_name)}
                      </span>
                      <span
                        className="text-xs font-black text-[#a3aac4]"
                        style={{ fontFamily: 'var(--font-space-grotesk)' }}
                      >
                        {ch.count}
                      </span>
                    </div>
                    <div className="h-4 border-2 border-black bg-black overflow-hidden">
                      <div
                        className={`h-full transition-all ${BAR_COLORS[Math.min(i, BAR_COLORS.length - 1)]}`}
                        style={{
                          width: `${(ch.count / maxCount) * 100}%`,
                          minWidth: '3px',
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Card 2 — Channel Summary */}
          <div
            className="relative bg-[#0f1930] border-4 border-black p-6 overflow-hidden"
            style={{ boxShadow: '4px 4px 0px 0px #000' }}
          >
            <div className="absolute top-0 left-0 w-[3px] h-full bg-[#b6a7ee]" />
            <div
              className="absolute inset-0 pointer-events-none"
              style={{ background: 'linear-gradient(45deg, rgba(189,157,255,0.05) 0%, rgba(255,255,255,0) 100%)' }}
            />
            <div className="flex items-center gap-2 mb-5 pl-4">
              <Hash className="h-5 w-5 text-[#d1c4ff]" />
              <h3
                className="font-black uppercase text-sm text-white"
                style={{ fontFamily: 'var(--font-space-grotesk)' }}
              >
                Channel Summary
              </h3>
            </div>

            <div className="pl-4 h-48 grid grid-cols-2 gap-4">
              {/* Total channels */}
              <div
                className="bg-[#091328] border-2 border-black p-4 flex flex-col justify-center items-center"
                style={{ boxShadow: '2px 2px 0px 0px #000' }}
              >
                <span
                  className="text-4xl font-black text-white"
                  style={{ fontFamily: 'var(--font-space-grotesk)' }}
                >
                  {configs.length}
                </span>
                <span
                  className="text-[10px] font-bold text-[#6d758c] uppercase tracking-widest mt-1"
                  style={{ fontFamily: 'var(--font-space-grotesk)' }}
                >
                  Total Channels
                </span>
              </div>

              {/* Disabled */}
              <div
                className="bg-[#091328] border-2 border-black p-4 flex flex-col justify-center items-center"
                style={{ boxShadow: '2px 2px 0px 0px #000' }}
              >
                <span
                  className="text-4xl font-black text-[#ff6e84]"
                  style={{ fontFamily: 'var(--font-space-grotesk)' }}
                >
                  {disabledChannels.length}
                </span>
                <span
                  className="text-[10px] font-bold text-[#6d758c] uppercase tracking-widest mt-1"
                  style={{ fontFamily: 'var(--font-space-grotesk)' }}
                >
                  Disabled
                </span>
              </div>

              {/* Warning row */}
              <div className="col-span-2 bg-black/30 border-2 border-black p-4 flex items-center gap-4">
                <div className="w-10 h-10 bg-[#ff6e84]/20 border-2 border-[#ff6e84] flex items-center justify-center shrink-0">
                  <AlertTriangle className="h-5 w-5 text-[#ff6e84]" />
                </div>
                {firstDisabled ? (
                  <div>
                    <p
                      className="text-sm font-black text-[#ff6e84]"
                      style={{ fontFamily: 'var(--font-space-grotesk)' }}
                    >
                      #{stripHash(firstDisabled.channel_name ?? firstDisabled.channel_id)}
                    </p>
                    <p className="text-xs text-[#6d758c]">Monitoring disabled</p>
                  </div>
                ) : (
                  <div>
                    <p className="text-sm font-bold text-green-400">All channels active</p>
                    <p className="text-xs text-[#6d758c]">No monitoring issues detected</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── All Channels table ── */}
        <div
          className="bg-[#0f1930] border-4 border-black overflow-hidden"
          style={{ boxShadow: '4px 4px 0px 0px #000' }}
        >
          {/* Table header bar */}
          <div className="p-6 border-b-4 border-black bg-slate-900 flex justify-between items-center">
            <h3
              className="font-black uppercase text-white tracking-widest"
              style={{ fontFamily: 'var(--font-space-grotesk)' }}
            >
              All Channels
            </h3>
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-[#6d758c]" />
                <input
                  type="text"
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-black/30 border-2 border-black pl-7 pr-3 py-1 text-xs text-[#dee5ff] placeholder-[#6d758c] focus:outline-none focus:border-[#bd9dff] w-44"
                />
              </div>
              <button className="p-2 border-2 border-black bg-[#141f38] hover:bg-[#192540] transition-colors">
                <Filter className="h-4 w-4 text-[#a3aac4]" />
              </button>
            </div>
          </div>

          <table className="w-full">
            <thead>
              <tr className="bg-[#141f38] border-b-2 border-black">
                {['Channel Name', 'Sensitivity', 'Monitoring Status', 'Min Replies', 'Total Tickets', ''].map(
                  (col) => (
                    <th
                      key={col}
                      className="p-4 text-xs font-black uppercase tracking-widest text-[#6d758c] text-left"
                      style={{ fontFamily: 'var(--font-space-grotesk)' }}
                    >
                      {col}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody className="divide-y-2 divide-black/10">
              {filteredConfigs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-[#6d758c]">
                    {configs.length === 0 ? 'No channels configured' : 'No channels match search'}
                  </td>
                </tr>
              ) : (
                filteredConfigs.map((config) => {
                  const name = stripHash(config.channel_name ?? config.channel_id)
                  const analytics = analyticsMap.get(name.toLowerCase())
                  const level = sensitivityLevel(config.sensitivity)
                  const disabled = !config.monitoring_active

                  return (
                    <tr
                      key={config.channel_id}
                      className={`hover:bg-[#bd9dff]/5 transition-colors ${disabled ? 'opacity-60' : ''}`}
                    >
                      {/* Channel name */}
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-8 h-8 border-2 flex items-center justify-center shrink-0 ${
                              disabled ? 'border-[#6d758c] bg-transparent' : 'border-black bg-[#0f1930]'
                            }`}
                          >
                            <Hash
                              className={`h-4 w-4 ${disabled ? 'text-[#6d758c]' : 'text-[#bd9dff]'}`}
                            />
                          </div>
                          <span
                            className={`font-bold text-sm ${
                              disabled ? 'text-[#6d758c] line-through' : 'text-[#dee5ff]'
                            }`}
                          >
                            #{name}
                          </span>
                        </div>
                      </td>

                      {/* Sensitivity */}
                      <td className="p-4">
                        <span
                          className={`px-2 py-1 text-[10px] font-black uppercase ${sensitivityBadge(level)}`}
                          style={{ fontFamily: 'var(--font-space-grotesk)' }}
                        >
                          {level}
                        </span>
                      </td>

                      {/* Monitoring toggle */}
                      <td className="p-4">
                        <MonitoringToggle
                          active={config.monitoring_active}
                          channelId={config.channel_id}
                          onChange={(v) => updateConfig(config.channel_id, { monitoring_active: v })}
                        />
                      </td>

                      {/* Min replies */}
                      <td className="p-4 text-center">
                        <span className="font-bold text-sm text-[#dee5ff]">
                          {config.min_replies}
                        </span>
                      </td>

                      {/* Total tickets */}
                      <td className="p-4 text-center">
                        <span
                          className="font-black text-sm text-[#bd9dff]"
                          style={{ fontFamily: 'var(--font-space-grotesk)' }}
                        >
                          {analytics?.count ?? '—'}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="p-4 text-right">
                        <button className="p-1 hover:bg-[#bd9dff]/10 transition-colors">
                          <MoreVertical className="h-4 w-4 text-[#6d758c]" />
                        </button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>

          {/* Table footer */}
          <div className="p-4 border-t-4 border-black bg-[#141f38] flex justify-between items-center">
            <span
              className="text-[10px] font-bold text-[#6d758c] uppercase tracking-widest"
              style={{ fontFamily: 'var(--font-space-grotesk)' }}
            >
              Showing {filteredConfigs.filter((c) => c.monitoring_active).length} of{' '}
              {configs.length} active node clusters
            </span>
            <div className="flex gap-2">
              {(['‹', '1', '›'] as const).map((p) => (
                <button
                  key={p}
                  className="w-8 h-8 border-2 border-black flex items-center justify-center text-xs font-bold text-[#a3aac4] hover:bg-[#bd9dff]/10 transition-colors"
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Bottom insight cards ── */}
        <div className="grid grid-cols-3 gap-8">

          {/* System Health */}
          <div
            className="bg-[#b28cff] border-4 border-black p-4 flex items-center gap-4"
            style={{ boxShadow: '4px 4px 0px 0px #000' }}
          >
            <div className="w-12 h-12 bg-black border-2 border-black flex items-center justify-center shrink-0">
              <Zap className="h-6 w-6 text-[#bd9dff]" />
            </div>
            <div>
              <h4
                className="font-black text-black uppercase text-sm mb-1"
                style={{ fontFamily: 'var(--font-space-grotesk)' }}
              >
                System Health
              </h4>
              <p className="text-xs text-black/70 font-bold">
                All nodes performing within 120ms latency
              </p>
            </div>
          </div>

          {/* Sensitivity Matrix */}
          <div
            className="bg-[#c3b4fc] border-4 border-black p-4 flex items-center gap-4"
            style={{ boxShadow: '4px 4px 0px 0px #000' }}
          >
            <div className="w-12 h-12 bg-black border-2 border-black flex items-center justify-center shrink-0">
              <Shield className="h-6 w-6 text-[#d1c4ff]" />
            </div>
            <div>
              <h4
                className="font-black text-[#3d306f] uppercase text-sm mb-1"
                style={{ fontFamily: 'var(--font-space-grotesk)' }}
              >
                Sensitivity Matrix
              </h4>
              <p className="text-xs text-[#3d306f]/70 font-bold">
                {configs.filter((c) => sensitivityLevel(c.sensitivity) === 'high').length}/
                {configs.length} channels monitoring high-risk data
              </p>
            </div>
          </div>

          {/* Add Channel */}
          <div
            className="bg-[#192540] border-4 border-black p-4 flex items-center gap-4"
            style={{ boxShadow: '4px 4px 0px 0px #000' }}
          >
            <div className="w-12 h-12 bg-[#bd9dff] border-2 border-black flex items-center justify-center shrink-0">
              <Plus className="h-6 w-6 text-[#3c0089]" />
            </div>
            <div>
              <h4
                className="font-black text-[#dee5ff] uppercase text-sm mb-1"
                style={{ fontFamily: 'var(--font-space-grotesk)' }}
              >
                Add Channel
              </h4>
              <p className="text-xs text-[#6d758c] font-bold">
                Ingest new Slack endpoint
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
