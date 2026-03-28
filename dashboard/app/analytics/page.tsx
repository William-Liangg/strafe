'use client'

import { TrendingUp, Calendar, Hash, Settings, Plus, Download, Archive } from 'lucide-react'
import { useSummary, useChannels, useEngineers } from '@/lib/hooks'

// ─── helpers ─────────────────────────────────────────────────────────────────

function initials(name: string) {
  return name.split(' ').map((p) => p[0]).join('').toUpperCase().slice(0, 2)
}

// ─── loading / error states ──────────────────────────────────────────────────

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
      <div className="bg-[#a70138] border-2 border-black p-4 flex items-center gap-4">
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

// ─── brutalist bar chart ──────────────────────────────────────────────────────

function BrutalistBarChart({
  trendData,
}: {
  trendData: { sprint_name: string; adhoc_percentage: number }[]
}) {
  const maxPct = Math.max(...trendData.map((d) => d.adhoc_percentage), 1)
  const midIndex = Math.floor(trendData.length / 2)

  return (
    <div className="relative bg-[#0f1930] border-2 border-black shadow-[4px_4px_0px_0px_#000] p-6 h-full flex flex-col">
      {/* Top accent */}
      <div className="absolute top-0 left-0 w-full h-1 bg-[#bd9dff]" />

      <h3
        className="font-black uppercase text-xs text-[#40485d] tracking-widest mb-6 mt-1"
        style={{ fontFamily: 'var(--font-space-grotesk)' }}
      >
        Adhoc % Trend · Last {trendData.length} Sprints
      </h3>

      {/* Axis container */}
      <div className="flex-1 flex items-end border-l-4 border-b-4 border-black pl-4 pb-0 min-h-[160px]">
        <div className="flex items-end gap-4 w-full h-full">
          {trendData.map((item, i) => {
            const heightPct = (item.adhoc_percentage / maxPct) * 100
            const isPrimary = i === midIndex
            return (
              <div key={item.sprint_name} className="flex-1 flex flex-col items-center justify-end gap-0 h-full">
                {/* Percentage tooltip */}
                <span
                  className="font-black text-xs text-white mb-2 bg-black px-1 py-0.5 border border-[#40485d]"
                  style={{ fontFamily: 'var(--font-space-grotesk)' }}
                >
                  {item.adhoc_percentage.toFixed(1)}%
                </span>
                {/* Bar */}
                <div
                  className={`w-full border-2 border-black transition-all ${
                    isPrimary ? 'bg-[#bd9dff]' : 'bg-[#192540]'
                  }`}
                  style={{ height: `${Math.max(heightPct, 3)}%` }}
                />
              </div>
            )
          })}
        </div>
      </div>

      {/* Labels */}
      <div className="flex gap-4 pl-4 mt-3">
        {trendData.map((item) => (
          <div key={item.sprint_name} className="flex-1 text-center">
            <span
              className="font-black text-[10px] text-[#a3aac4] uppercase tracking-tighter"
              style={{ fontFamily: 'var(--font-space-grotesk)' }}
            >
              {item.sprint_name}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── page ─────────────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const { data: summary, error: summaryError, mutate: mutateSummary } = useSummary()
  const { data: channelsData, error: channelsError, mutate: mutateChannels } = useChannels({ since_days: 30 })
  const { data: engineersData, error: engineersError, mutate: mutateEngineers } = useEngineers()

  const isLoading =
    (!summary && !summaryError) ||
    (!channelsData && !channelsError) ||
    (!engineersData && !engineersError)

  const hasError = summaryError || channelsError || engineersError

  if (isLoading) return <PageSkeleton />
  if (hasError)
    return (
      <PageError
        message="Failed to load analytics data"
        onRetry={() => {
          mutateSummary()
          mutateChannels()
          mutateEngineers()
        }}
      />
    )

  const sprint = summary?.current_sprint
  const comparison = summary?.comparison_to_last_sprint
  const trendData = (summary?.trend ?? []).slice(-3)
  const channels = channelsData?.channels ?? []
  const engineers = engineersData?.engineers ?? []
  const maxChannelCount = Math.max(...channels.map((c) => c.count), 1)

  return (
    <div className="flex flex-col min-h-screen bg-[#060e20]">
      {/* Sticky header */}
      <header
        className="sticky top-0 z-30 border-b-4 border-black bg-slate-900/80 backdrop-blur-md flex justify-between items-center px-8 py-4 shadow-[0px_4px_0px_0px_rgba(0,0,0,1)]"
      >
        <div className="flex items-center gap-4">
          <span
            className="text-3xl font-black italic tracking-tighter text-slate-50"
            style={{ fontFamily: 'var(--font-space-grotesk)' }}
          >
            Analytics
          </span>
          {sprint && (
            <span
              className="px-2 py-1 bg-[#bd9dff] text-[#3c0089] text-[10px] font-black uppercase tracking-widest border-2 border-black"
              style={{ fontFamily: 'var(--font-space-grotesk)' }}
            >
              {sprint.sprint_name}
            </span>
          )}
        </div>
        <button
          onClick={() => { mutateSummary(); mutateChannels(); mutateEngineers() }}
          className="bg-[#bd9dff] text-[#3c0089] px-6 py-2 border-2 border-black font-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:scale-95 duration-100"
          style={{ fontFamily: 'var(--font-space-grotesk)' }}
        >
          Refresh
        </button>
      </header>

      {/* Main content */}
      <main className="flex-1 p-8 pb-24">
        <div className="grid grid-cols-12 gap-6">

          {/* ── KPI Cards (col-span-4) ── */}
          <div className="col-span-4 flex flex-col gap-6">

            {/* Card 1: Efficiency Rating */}
            <div className="relative bg-[#0f1930] border-2 border-black shadow-[4px_4px_0px_0px_#000] p-6 overflow-hidden"
              style={{ background: 'linear-gradient(45deg, rgba(189,157,255,0.05) 0%, rgba(255,255,255,0) 100%), #0f1930' }}
            >
              <div className="absolute left-0 top-0 h-full w-[3px] bg-[#ff6e84]" />
              <p
                className="text-[10px] font-black text-[#40485d] uppercase tracking-widest mb-3"
                style={{ fontFamily: 'var(--font-space-grotesk)' }}
              >
                Efficiency Rating
              </p>
              <p
                className="text-6xl font-black text-white leading-none"
                style={{ fontFamily: 'var(--font-space-grotesk)' }}
              >
                {sprint ? `${sprint.adhoc_percentage.toFixed(1)}%` : '—'}
              </p>
              {comparison && (
                <div className="flex items-center gap-1 mt-3 text-[#ff6e84] text-sm font-bold">
                  <TrendingUp className="h-4 w-4 shrink-0" />
                  <span>
                    +{comparison.difference.toFixed(1)}% vs Last Sprint
                  </span>
                </div>
              )}
            </div>

            {/* Card 2: Volume Analysis */}
            <div className="relative bg-[#0f1930] border-2 border-black shadow-[4px_4px_0px_0px_#000] p-6 overflow-hidden"
              style={{ background: 'linear-gradient(45deg, rgba(189,157,255,0.05) 0%, rgba(255,255,255,0) 100%), #0f1930' }}
            >
              <div className="absolute left-0 top-0 h-full w-[3px] bg-[#bd9dff]" />
              <p
                className="text-[10px] font-black text-[#40485d] uppercase tracking-widest mb-3"
                style={{ fontFamily: 'var(--font-space-grotesk)' }}
              >
                Volume Analysis
              </p>
              <p
                className="text-6xl font-black text-white leading-none"
                style={{ fontFamily: 'var(--font-space-grotesk)' }}
              >
                {summary?.total_adhoc_this_sprint ?? 0}
                <span className="text-2xl ml-2 text-[#a3aac4]">Adhoc</span>
              </p>
              <div className="flex items-center gap-1 mt-3 text-[#bd9dff] text-sm font-bold">
                <Calendar className="h-4 w-4 shrink-0" />
                <span>{sprint?.sprint_name ?? 'Sprint Active'}</span>
              </div>
            </div>
          </div>

          {/* ── Trend Chart (col-span-8) ── */}
          <div className="col-span-8">
            {trendData.length > 0 ? (
              <BrutalistBarChart trendData={trendData} />
            ) : (
              <div className="bg-[#0f1930] border-2 border-black h-full flex items-center justify-center text-[#40485d]">
                No trend data available
              </div>
            )}
          </div>

          {/* ── Top Source Channels (col-span-5) ── */}
          <div className="col-span-5 bg-[#0f1930] border-2 border-black shadow-[4px_4px_0px_0px_#000] p-6">
            <h3
              className="font-black uppercase text-xs text-[#40485d] tracking-widest mb-6"
              style={{ fontFamily: 'var(--font-space-grotesk)' }}
            >
              Top Source Channels · Last 30 Days
            </h3>

            {channels.length === 0 ? (
              <p className="text-[#6d758c] text-sm">No channel data</p>
            ) : (
              <div className="space-y-5">
                {channels.slice(0, 6).map((ch, i) => (
                  <div key={ch.channel_name}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Hash className="h-3 w-3 text-[#6d758c] shrink-0" />
                        <span
                          className="text-sm font-bold text-[#dee5ff]"
                          style={{ fontFamily: 'var(--font-space-grotesk)' }}
                        >
                          {ch.channel_name}
                        </span>
                      </div>
                      <span
                        className="text-xs font-black text-[#bd9dff]"
                        style={{ fontFamily: 'var(--font-space-grotesk)' }}
                      >
                        {ch.count}
                      </span>
                    </div>
                    <div className="h-10 border-2 border-black bg-[#060e20] overflow-hidden">
                      <div
                        className={`h-full transition-all ${i === 0 ? 'bg-[#bd9dff]' : 'bg-violet-400/70'}`}
                        style={{ width: `${(ch.count / maxChannelCount) * 100}%`, minWidth: '4px' }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Engineer Adhoc Load (col-span-7) ── */}
          <div className="col-span-7 bg-[#0f1930] border-2 border-black shadow-[4px_4px_0px_0px_#000] p-6">
            <h3
              className="font-black uppercase text-xs text-[#40485d] tracking-widest mb-6"
              style={{ fontFamily: 'var(--font-space-grotesk)' }}
            >
              Engineer Adhoc Load · {sprint?.sprint_name ?? 'Current Sprint'}
            </h3>

            {engineers.length === 0 ? (
              <p className="text-[#6d758c] text-sm">No engineer data</p>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b-2 border-black/20">
                    {['Engineer', 'Tickets', 'Dev Hours'].map((col) => (
                      <th
                        key={col}
                        className={`py-3 font-black uppercase text-xs text-[#40485d] tracking-widest ${col === 'Engineer' ? 'text-left' : 'text-center'}`}
                        style={{ fontFamily: 'var(--font-space-grotesk)' }}
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y-2 divide-black/10">
                  {engineers.map((eng, i) => (
                    <tr
                      key={eng.engineer_slack_id ?? eng.engineer_name}
                      className={i === 0 ? 'bg-[#bd9dff]/10 border-l-4 border-l-[#bd9dff]' : ''}
                    >
                      <td className="py-4 pl-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 border-2 border-black bg-[#192540] flex items-center justify-center font-black text-[10px] text-[#bd9dff] shrink-0"
                            style={{ fontFamily: 'var(--font-space-grotesk)' }}
                          >
                            {initials(eng.engineer_name)}
                          </div>
                          <span className="text-sm font-bold text-[#dee5ff]">{eng.engineer_name}</span>
                        </div>
                      </td>
                      <td className="py-4 text-center">
                        <span
                          className="text-sm font-black text-[#dee5ff]"
                          style={{ fontFamily: 'var(--font-space-grotesk)' }}
                        >
                          {eng.adhoc_tickets}
                        </span>
                      </td>
                      <td className="py-4 text-center">
                        <span
                          className="text-sm font-black text-[#bd9dff]"
                          style={{ fontFamily: 'var(--font-space-grotesk)' }}
                        >
                          {eng.adhoc_points}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="flex items-center justify-between mt-8 pt-6 border-t-2 border-black/20">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span
                className="text-xs font-bold text-[#a3aac4] uppercase tracking-widest"
                style={{ fontFamily: 'var(--font-space-grotesk)' }}
              >
                Slack Sync: Active
              </span>
            </div>
            <span className="text-[#40485d] text-xs">·</span>
            <span className="text-xs text-[#6d758c]">Last ingestion: 2 minutes ago</span>
          </div>
          <div className="flex items-center gap-6">
            <button className="flex items-center gap-2 text-[#bd9dff] text-xs font-bold hover:underline"
              style={{ fontFamily: 'var(--font-space-grotesk)' }}>
              <Download className="h-3 w-3" />
              Export Report
            </button>
            <button className="flex items-center gap-2 text-[#a3aac4] text-xs font-bold hover:underline"
              style={{ fontFamily: 'var(--font-space-grotesk)' }}>
              <Archive className="h-3 w-3" />
              Archived Sprints
            </button>
          </div>
        </div>
      </main>

      {/* ── Floating Action Rail ── */}
      <div className="fixed bottom-8 right-8 flex flex-col gap-3 z-40">
        <button
          className="w-14 h-14 bg-[#192540] border-2 border-black shadow-[4px_4px_0px_0px_#000] flex items-center justify-center hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_#000] transition-all"
          title="Settings"
        >
          <Settings className="h-6 w-6 text-[#a3aac4]" />
        </button>
        <button
          className="w-14 h-14 bg-[#bd9dff] border-2 border-black shadow-[4px_4px_0px_0px_#000] flex items-center justify-center hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_#000] transition-all"
          title="Add"
        >
          <Plus className="h-7 w-7 text-[#3c0089]" />
        </button>
      </div>
    </div>
  )
}
