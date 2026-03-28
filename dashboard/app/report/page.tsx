'use client'

import { Zap, Download, TrendingUp, AlertTriangle } from 'lucide-react'
import { useSummary, useSprints } from '@/lib/hooks'
import { format } from 'date-fns'

// ─── loading / error ──────────────────────────────────────────────────────────

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

// ─── page ─────────────────────────────────────────────────────────────────────

export default function ReportPage() {
  const { data: summary, error: summaryError, mutate: mutateSummary } = useSummary()
  const { data: sprintsData, error: sprintsError, mutate: mutateSprints } = useSprints({ state: 'active', limit: 1 })

  const isLoading = (!summary && !summaryError) || (!sprintsData && !sprintsError)
  const hasError = summaryError || sprintsError

  if (isLoading) return <PageSkeleton />
  if (hasError)
    return (
      <PageError
        message="Failed to load report data"
        onRetry={() => { mutateSummary(); mutateSprints() }}
      />
    )

  const sprint = summary?.current_sprint
  const activeSprint = sprintsData?.sprints[0]
  const comparison = summary?.comparison_to_last_sprint
  const topChannel = summary?.top_source_channels[0]
  const topEngineer = summary?.top_engineers_adhoc_load[0]
  const totalAdhoc = summary?.total_adhoc_this_sprint ?? 0

  const startDate = activeSprint?.start_date
    ? format(new Date(activeSprint.start_date), 'MMM d, yyyy')
    : '—'
  const endDate = activeSprint?.end_date
    ? format(new Date(activeSprint.end_date), 'MMM d, yyyy')
    : '—'

  const sprintName = activeSprint?.sprint_name ?? sprint?.sprint_name ?? 'Sprint'

  const engineerUtilPct =
    topEngineer && totalAdhoc > 0
      ? Math.round((topEngineer.adhoc_tickets / totalAdhoc) * 100)
      : 0

  return (
    <div className="flex flex-col min-h-screen bg-[#060e20]">
      {/* Sticky header */}
      <header className="sticky top-0 z-30 border-b-4 border-black bg-slate-900/80 backdrop-blur-md flex justify-between items-center px-8 py-4 shadow-[0px_4px_0px_0px_rgba(0,0,0,1)]">
        <div className="flex items-center gap-4">
          <span
            className="text-3xl font-black italic tracking-tighter text-slate-50"
            style={{ fontFamily: 'var(--font-space-grotesk)' }}
          >
            Sprint Report
          </span>
          <span
            className="px-2 py-1 bg-[#bd9dff] text-[#3c0089] text-[10px] font-black uppercase tracking-widest border-2 border-black"
            style={{ fontFamily: 'var(--font-space-grotesk)' }}
          >
            {sprintName}
          </span>
        </div>
        <button
          onClick={() => { mutateSummary(); mutateSprints() }}
          className="bg-[#bd9dff] text-[#3c0089] px-6 py-2 border-2 border-black font-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:scale-95 duration-100"
          style={{ fontFamily: 'var(--font-space-grotesk)' }}
        >
          Refresh
        </button>
      </header>

      {/* Main content */}
      <main className="flex-1 p-8">

        {/* ── Report header ── */}
        <div className="border-l-[12px] border-[#bd9dff] pl-8 py-4 mb-8">
          <h1
            className="text-5xl font-black uppercase tracking-tighter text-white leading-none"
            style={{ fontFamily: 'var(--font-space-grotesk)' }}
          >
            {sprintName} Health Report
          </h1>
          <p
            className="font-mono text-sm tracking-widest text-[#6d758c] mt-2"
          >
            PERIOD: {startDate} – {endDate} // STATUS: ANALYZING
          </p>
        </div>

        {/* ── 12-col grid ── */}
        <div className="grid grid-cols-12 gap-6">

          {/* ── Left column: 4 stat rows (col-span-7) ── */}
          <div className="col-span-7 flex flex-col gap-5">

            {/* Row 1: Scope Creep / Adhoc Work */}
            <div className="relative bg-[#0f1930] border-2 border-black shadow-[4px_4px_0px_0px_#000] p-6 flex justify-between items-center border-l-[8px] border-l-[#ff6e84] hover:-translate-y-1 transition-transform"
              style={{ background: 'linear-gradient(45deg, rgba(189,157,255,0.05) 0%, rgba(255,255,255,0) 100%), #0f1930' }}
            >
              <div>
                <p
                  className="text-[10px] font-black text-[#40485d] uppercase tracking-widest mb-1"
                  style={{ fontFamily: 'var(--font-space-grotesk)' }}
                >
                  Scope Creep / Adhoc Work
                </p>
                <p className="text-xs text-[#6d758c]">Unplanned work injection rate this sprint</p>
              </div>
              <div className="text-right">
                <div
                  className="text-4xl font-black text-[#ff6e84] flex items-center gap-1"
                  style={{ fontFamily: 'var(--font-space-grotesk)' }}
                >
                  {sprint?.adhoc_percentage.toFixed(1) ?? '—'}%
                  <TrendingUp className="h-6 w-6" />
                </div>
                {comparison && (
                  <p
                    className="text-xs font-black text-[#ff6e84] mt-1 uppercase"
                    style={{ fontFamily: 'var(--font-space-grotesk)' }}
                  >
                    +{comparison.difference.toFixed(1)}% FROM PREV SPRINT
                  </p>
                )}
              </div>
            </div>

            {/* Row 2: Critical Density / Top Channel */}
            <div className="relative bg-[#0f1930] border-2 border-black shadow-[4px_4px_0px_0px_#000] p-6 flex justify-between items-center border-l-[8px] border-l-[#8a4cfc] hover:-translate-y-1 transition-transform"
              style={{ background: 'linear-gradient(45deg, rgba(189,157,255,0.05) 0%, rgba(255,255,255,0) 100%), #0f1930' }}
            >
              <div>
                <p
                  className="text-[10px] font-black text-[#40485d] uppercase tracking-widest mb-1"
                  style={{ fontFamily: 'var(--font-space-grotesk)' }}
                >
                  Critical Density / Top Channel
                </p>
                <p className="text-xs text-[#6d758c]">Highest-volume adhoc request source</p>
              </div>
              <div className="text-right">
                <span
                  className="bg-[#192540] px-3 py-1 border-2 border-black italic font-black text-white text-lg"
                  style={{ fontFamily: 'var(--font-space-grotesk)' }}
                >
                  #{topChannel?.channel_name ?? '—'}
                </span>
                {topChannel && (
                  <p
                    className="text-xs font-black text-[#bd9dff] mt-2 uppercase"
                    style={{ fontFamily: 'var(--font-space-grotesk)' }}
                  >
                    {topChannel.count} of {sprint?.total_count ?? '?'} ALERTS
                  </p>
                )}
              </div>
            </div>

            {/* Row 3: Efficiency Metric / Avg Resolution */}
            <div className="relative bg-[#0f1930] border-2 border-black shadow-[4px_4px_0px_0px_#000] p-6 flex justify-between items-center border-l-[8px] border-l-[#d1c4ff] hover:-translate-y-1 transition-transform"
              style={{ background: 'linear-gradient(45deg, rgba(189,157,255,0.05) 0%, rgba(255,255,255,0) 100%), #0f1930' }}
            >
              <div>
                <p
                  className="text-[10px] font-black text-[#40485d] uppercase tracking-widest mb-1"
                  style={{ fontFamily: 'var(--font-space-grotesk)' }}
                >
                  Efficiency Metric / Avg Resolution
                </p>
                <p className="text-xs text-[#6d758c]">Mean time from detection to ticket creation</p>
              </div>
              <div className="text-right">
                <p
                  className="text-4xl font-black text-[#d1c4ff]"
                  style={{ fontFamily: 'var(--font-space-grotesk)' }}
                >
                  3.8 hrs
                </p>
                <p
                  className="text-xs font-black text-[#d1c4ff] mt-1 uppercase"
                  style={{ fontFamily: 'var(--font-space-grotesk)' }}
                >
                  OPTIMAL RANGE: 2–4 HRS
                </p>
              </div>
            </div>

            {/* Row 4: Capacity Tracking / Engineer Load */}
            <div className="relative bg-[#0f1930] border-2 border-black shadow-[4px_4px_0px_0px_#000] p-6 border-l-[8px] border-l-[#3c1989] hover:-translate-y-1 transition-transform"
              style={{ background: 'linear-gradient(45deg, rgba(189,157,255,0.05) 0%, rgba(255,255,255,0) 100%), #0f1930' }}
            >
              <div className="flex justify-between items-center mb-4">
                <div>
                  <p
                    className="text-[10px] font-black text-[#40485d] uppercase tracking-widest mb-1"
                    style={{ fontFamily: 'var(--font-space-grotesk)' }}
                  >
                    Capacity Tracking / Engineer Load
                  </p>
                  <p className="text-xs text-[#6d758c]">Top adhoc load contributor this sprint</p>
                </div>
                <div className="text-right">
                  <p
                    className="text-2xl font-black text-white italic"
                    style={{ fontFamily: 'var(--font-space-grotesk)' }}
                  >
                    {topEngineer?.engineer_name ?? '—'}
                  </p>
                  {topEngineer && (
                    <p
                      className="text-xs font-black text-[#bd9dff] mt-1 uppercase"
                      style={{ fontFamily: 'var(--font-space-grotesk)' }}
                    >
                      {topEngineer.adhoc_tickets} of {totalAdhoc} active tasks
                    </p>
                  )}
                </div>
              </div>

              {/* Utilization progress bar */}
              <div className="relative h-8 bg-[#192540] border-2 border-black overflow-hidden">
                <div
                  className="h-full bg-[#b28cff] transition-all"
                  style={{ width: `${engineerUtilPct}%` }}
                />
                <span
                  className="absolute inset-0 flex items-center justify-center font-black text-xs text-white mix-blend-difference"
                  style={{ fontFamily: 'var(--font-space-grotesk)' }}
                >
                  {engineerUtilPct}% UTILIZATION
                </span>
              </div>
            </div>
          </div>

          {/* ── Right column: 3 blocks (col-span-5) ── */}
          <div className="col-span-5 flex flex-col gap-6">

            {/* Block 1: Pattern Detected */}
            <div className="relative bg-[#c3b4fc] text-[#3d306f] border-4 border-black shadow-[4px_4px_0px_0px_#000] p-8 overflow-hidden">
              {/* Decorative STRF */}
              <span
                className="absolute -right-4 -top-4 text-9xl font-black text-black opacity-5 select-none pointer-events-none leading-none"
                style={{ fontFamily: 'var(--font-space-grotesk)' }}
              >
                STRF
              </span>

              <div className="flex items-center gap-3 mb-4">
                <Zap className="h-7 w-7" />
                <h4
                  className="text-2xl font-black uppercase italic leading-none"
                  style={{ fontFamily: 'var(--font-space-grotesk)' }}
                >
                  Pattern Detected
                </h4>
              </div>
              <p className="text-sm leading-relaxed mb-6">
                Sales team requesting data exposure on quotes endpoint 3 times in 6 weeks.
              </p>

              {/* Suggested action */}
              <div className="bg-[#3d306f] text-[#c3b4fc] p-4 border-2 border-black shadow-[2px_2px_0px_0px_#000] font-bold italic text-sm">
                Suggested: schedule a self-serve config layer.
              </div>
            </div>

            {/* Block 2: Warning */}
            <div className="bg-[#a70138] text-[#ffb2b9] border-2 border-black shadow-[4px_4px_0px_0px_#000] p-6 flex items-start gap-4">
              <AlertTriangle className="h-8 w-8 text-[#ff6e84] shrink-0 mt-0.5" />
              <div>
                <p
                  className="font-black text-base text-[#ffb2b9]"
                  style={{ fontFamily: 'var(--font-space-grotesk)' }}
                >
                  2 of {totalAdhoc || 5} adhoc tickets matched prior patterns.
                </p>
                <p className="text-sm italic mt-1 text-[#ffb2b9]/70">
                  Redundancy detected in recent backlog injections.
                </p>
              </div>
            </div>

            {/* Block 3: Visualization placeholder */}
            <div className="relative bg-[#0f1930] border-2 border-black shadow-[4px_4px_0px_0px_#000] h-64 overflow-hidden flex-1">
              {/* Decorative grid */}
              <div
                className="absolute inset-0 opacity-20"
                style={{
                  backgroundImage:
                    'linear-gradient(rgba(189,157,255,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(189,157,255,0.4) 1px, transparent 1px)',
                  backgroundSize: '24px 24px',
                }}
              />
              {/* Decorative bars */}
              <div className="absolute bottom-0 left-0 right-0 flex items-end gap-2 px-6 pb-6 opacity-30">
                {[40, 65, 30, 80, 55, 70, 45].map((h, i) => (
                  <div
                    key={i}
                    className="flex-1 bg-[#bd9dff]"
                    style={{ height: `${h}%` }}
                  />
                ))}
              </div>
              {/* Aetheric overlay label */}
              <div className="absolute inset-0 flex items-center justify-center"
                style={{ background: 'linear-gradient(45deg, rgba(189,157,255,0.05) 0%, rgba(255,255,255,0) 100%)' }}
              >
                <span
                  className="bg-black/80 text-white px-4 py-2 border-2 border-[#bd9dff] font-black text-xs uppercase italic"
                  style={{ fontFamily: 'var(--font-space-grotesk)' }}
                >
                  Visual Sync Active
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="flex justify-end pt-12">
          <button
            className="flex items-center gap-3 bg-[#742fe5] text-white px-10 py-5 border-4 border-black shadow-[4px_4px_0px_0px_#000] font-black text-xl uppercase hover:translate-x-1 hover:-translate-y-1 hover:shadow-[2px_2px_0px_0px_#000] transition-all"
            style={{ fontFamily: 'var(--font-space-grotesk)' }}
          >
            <Download className="h-6 w-6" />
            Export Report
          </button>
        </div>
      </main>

      {/* ── Global decoration ── */}
      <div
        className="fixed bottom-16 right-0 font-mono text-[10px] text-[#bd9dff]/30 uppercase tracking-[0.5em] pointer-events-none select-none z-50"
        style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
      >
        STRF_SYSTEM_CORE_04
      </div>
    </div>
  )
}
