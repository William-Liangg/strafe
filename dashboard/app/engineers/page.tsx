'use client'

import { TrendingUp, TrendingDown, Minus, AlertTriangle, Users } from 'lucide-react'
import { useEngineers } from '@/lib/hooks'

function getInitials(name: string) {
  return name.split(' ').map((p) => p[0]).join('').toUpperCase().slice(0, 2)
}

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

function TrendIcon({ trend }: { trend: 'up' | 'down' | 'flat' }) {
  if (trend === 'up') return <TrendingUp className="h-4 w-4 text-[#ff6e84]" />
  if (trend === 'down') return <TrendingDown className="h-4 w-4 text-green-400" />
  return <Minus className="h-4 w-4 text-[#6d758c]" />
}

export default function EngineersPage() {
  const { data, error, mutate } = useEngineers()

  if (!data && !error) return <PageSkeleton />
  if (error) return <PageError message="Failed to load engineer data" onRetry={() => mutate()} />

  const engineers = data?.engineers ?? []
  const stats = data?.team_stats

  const maxAdhocPoints = Math.max(...engineers.map((e) => e.adhoc_points), 1)

  return (
    <div className="flex flex-col min-h-screen bg-[#060e20]">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b-4 border-black bg-slate-900/80 backdrop-blur-md px-8 py-4 shadow-[0px_4px_0px_0px_rgba(0,0,0,1)]">
        <div className="flex items-center justify-between">
          <div>
            <h1
              className="text-3xl font-black italic tracking-tighter text-slate-50"
              style={{ fontFamily: 'var(--font-space-grotesk)' }}
            >
              Team Workload
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Who is being pulled away from planned work?
            </p>
          </div>
          <button
            onClick={() => mutate()}
            className="bg-[#bd9dff] text-black px-4 py-2 font-black border-2 border-black shadow-[2px_2px_0px_0px_#000] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none transition-all"
            style={{ fontFamily: 'var(--font-space-grotesk)' }}
          >
            Refresh
          </button>
        </div>
      </header>

      <main className="flex-1 p-8 space-y-8">
        {/* Team Health Snapshot - 3 big numbers */}
        <section className="grid grid-cols-3 gap-6">
          {/* Total adhoc points */}
          <div
            className="relative bg-[#0f1930] border-4 border-black p-6 overflow-hidden"
            style={{ boxShadow: '4px 4px 0px 0px #000' }}
          >
            <div className="absolute top-0 left-0 w-[3px] h-full bg-[#bd9dff]" />
            <p
              className="text-[10px] font-black text-[#6d758c] uppercase tracking-widest mb-2 pl-4"
              style={{ fontFamily: 'var(--font-space-grotesk)' }}
            >
              Total Adhoc Points This Sprint
            </p>
            <p
              className="text-5xl font-black text-white pl-4"
              style={{ fontFamily: 'var(--font-space-grotesk)' }}
            >
              {stats?.total_adhoc_points ?? 0}
            </p>
            <p className="text-xs text-[#6d758c] pl-4 mt-2">
              Story points absorbed by unplanned work
            </p>
          </div>

          {/* Most impacted */}
          <div
            className="relative bg-[#0f1930] border-4 border-black p-6 overflow-hidden"
            style={{ boxShadow: '4px 4px 0px 0px #000' }}
          >
            <div className="absolute top-0 left-0 w-[3px] h-full bg-[#ff6e84]" />
            <p
              className="text-[10px] font-black text-[#6d758c] uppercase tracking-widest mb-2 pl-4"
              style={{ fontFamily: 'var(--font-space-grotesk)' }}
            >
              Most Impacted Engineer
            </p>
            <p
              className="text-3xl font-black text-[#ff6e84] pl-4"
              style={{ fontFamily: 'var(--font-space-grotesk)' }}
            >
              {stats?.most_impacted_name ?? '—'}
            </p>
            <p className="text-lg text-white pl-4 mt-1 font-bold">
              {stats?.most_impacted_points ?? 0} pts unplanned
            </p>
          </div>

          {/* % with adhoc */}
          <div
            className="relative bg-[#0f1930] border-4 border-black p-6 overflow-hidden"
            style={{ boxShadow: '4px 4px 0px 0px #000' }}
          >
            <div className="absolute top-0 left-0 w-[3px] h-full bg-[#d1c4ff]" />
            <p
              className="text-[10px] font-black text-[#6d758c] uppercase tracking-widest mb-2 pl-4"
              style={{ fontFamily: 'var(--font-space-grotesk)' }}
            >
              Team Adhoc Coverage
            </p>
            <p
              className="text-5xl font-black text-white pl-4"
              style={{ fontFamily: 'var(--font-space-grotesk)' }}
            >
              {stats?.pct_carrying_adhoc ?? 0}%
            </p>
            <p className="text-xs text-[#6d758c] pl-4 mt-2">
              {stats?.engineers_with_adhoc ?? 0} of {stats?.total_engineers ?? 0} engineers carrying adhoc
            </p>
          </div>
        </section>

        {/* Engineer Cards */}
        <section>
          <div className="flex items-center gap-3 mb-6">
            <Users className="h-6 w-6 text-[#bd9dff]" />
            <h2
              className="text-2xl font-black uppercase text-white"
              style={{ fontFamily: 'var(--font-space-grotesk)' }}
            >
              Individual Workload
            </h2>
          </div>

          {engineers.length === 0 ? (
            <div className="bg-[#0f1930] border-2 border-black p-8 text-center text-[#6d758c]">
              No engineer data for current sprint
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-6">
              {engineers.map((eng) => (
                <div
                  key={eng.engineer_slack_id ?? eng.engineer_name}
                  className="relative bg-[#0f1930] border-4 border-black p-6"
                  style={{ boxShadow: '4px 4px 0px 0px #000' }}
                >
                  {/* Header row */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-4">
                      <div
                        className="w-12 h-12 border-2 border-black bg-[#bd9dff] flex items-center justify-center font-black text-[#3c0089] shrink-0"
                        style={{ fontFamily: 'var(--font-space-grotesk)' }}
                      >
                        {getInitials(eng.engineer_name)}
                      </div>
                      <div>
                        <h3
                          className="text-lg font-black text-white"
                          style={{ fontFamily: 'var(--font-space-grotesk)' }}
                        >
                          {eng.engineer_name}
                        </h3>
                        {eng.top_domain && (
                          <p className="text-xs text-[#bd9dff] font-medium">
                            {eng.top_domain}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Trend indicator */}
                    <div className="flex items-center gap-1">
                      <TrendIcon trend={eng.trend} />
                      <span
                        className={`text-xs font-bold ${
                          eng.trend === 'up' ? 'text-[#ff6e84]' : eng.trend === 'down' ? 'text-green-400' : 'text-[#6d758c]'
                        }`}
                      >
                        {eng.trend === 'up' ? 'Rising' : eng.trend === 'down' ? 'Falling' : 'Stable'}
                      </span>
                    </div>
                  </div>

                  {/* Key metric: Adhoc percentage */}
                  <div className="mb-4 p-3 bg-black/30 border border-black">
                    <div className="flex items-baseline justify-between">
                      <span className="text-xs text-[#6d758c] uppercase font-bold">Adhoc Load</span>
                      <span
                        className={`text-2xl font-black ${
                          eng.adhoc_percentage >= 50 ? 'text-[#ff6e84]' : eng.adhoc_percentage >= 25 ? 'text-[#fbbf24]' : 'text-green-400'
                        }`}
                        style={{ fontFamily: 'var(--font-space-grotesk)' }}
                      >
                        {eng.adhoc_percentage}%
                      </span>
                    </div>
                    <p className="text-xs text-[#6d758c] mt-1">
                      of their sprint is unplanned work
                    </p>
                  </div>

                  {/* Ticket breakdown */}
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-[10px] text-[#6d758c] uppercase font-bold mb-1">Adhoc</p>
                      <p className="text-white font-bold">
                        {eng.adhoc_tickets} tickets
                        <span className="text-[#bd9dff] ml-2">{eng.adhoc_points} pts</span>
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-[#6d758c] uppercase font-bold mb-1">Planned</p>
                      <p className="text-white font-bold">
                        {eng.planned_tickets} tickets
                        <span className="text-[#6d758c] ml-2">{eng.planned_points} pts</span>
                      </p>
                    </div>
                  </div>

                  {/* vs last sprint */}
                  {eng.last_sprint_adhoc_points > 0 && (
                    <p className="text-xs text-[#6d758c] mt-3 pt-3 border-t border-black/30">
                      Last sprint: {eng.last_sprint_adhoc_points} adhoc pts
                      {eng.adhoc_points > eng.last_sprint_adhoc_points && (
                        <span className="text-[#ff6e84] ml-1">
                          (+{eng.adhoc_points - eng.last_sprint_adhoc_points})
                        </span>
                      )}
                      {eng.adhoc_points < eng.last_sprint_adhoc_points && (
                        <span className="text-green-400 ml-1">
                          ({eng.adhoc_points - eng.last_sprint_adhoc_points})
                        </span>
                      )}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Concentration Risk Bar */}
        {engineers.length > 0 && (
          <section>
            <h2
              className="text-lg font-black uppercase text-white mb-4"
              style={{ fontFamily: 'var(--font-space-grotesk)' }}
            >
              Adhoc Load Distribution
            </h2>
            <div
              className="bg-[#0f1930] border-4 border-black p-6"
              style={{ boxShadow: '4px 4px 0px 0px #000' }}
            >
              <div className="space-y-3">
                {engineers.map((eng, i) => {
                  const widthPct = (eng.adhoc_points / maxAdhocPoints) * 100
                  const isHighest = i === 0 && eng.adhoc_points > 0

                  return (
                    <div key={eng.engineer_slack_id ?? eng.engineer_name} className="flex items-center gap-4">
                      <div className="w-28 shrink-0">
                        <span className={`text-sm font-bold ${isHighest ? 'text-[#ff6e84]' : 'text-[#a3aac4]'}`}>
                          {eng.engineer_name.split(' ')[0]}
                        </span>
                      </div>
                      <div className="flex-1 h-6 bg-black/30 border border-black overflow-hidden">
                        <div
                          className={`h-full transition-all ${isHighest ? 'bg-[#ff6e84]' : 'bg-[#bd9dff]'}`}
                          style={{ width: `${Math.max(widthPct, 2)}%` }}
                        />
                      </div>
                      <div className="w-16 text-right">
                        <span
                          className={`text-sm font-black ${isHighest ? 'text-[#ff6e84]' : 'text-[#a3aac4]'}`}
                          style={{ fontFamily: 'var(--font-space-grotesk)' }}
                        >
                          {eng.adhoc_points} pts
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Concentration warning */}
              {engineers.length > 1 && engineers[0].adhoc_points > 0 && (
                (() => {
                  const top = engineers[0].adhoc_points
                  const second = engineers[1]?.adhoc_points ?? 0
                  const ratio = second > 0 ? top / second : top

                  if (ratio >= 2) {
                    return (
                      <div className="mt-6 p-4 bg-[#ff6e84]/10 border-2 border-[#ff6e84] flex items-start gap-3">
                        <AlertTriangle className="h-5 w-5 text-[#ff6e84] shrink-0 mt-0.5" />
                        <div>
                          <p className="text-sm font-bold text-[#ff6e84]">
                            Concentration Risk Detected
                          </p>
                          <p className="text-xs text-[#ffb2b9] mt-1">
                            {engineers[0].engineer_name} is carrying {ratio.toFixed(1)}x more adhoc load than the next engineer.
                            This may indicate a knowledge silo or documentation gap.
                          </p>
                        </div>
                      </div>
                    )
                  }
                  return null
                })()
              )}
            </div>
          </section>
        )}

        {/* Footer insight */}
        <div className="text-center py-8 border-t border-black/20">
          <p className="text-xs text-[#6d758c] max-w-xl mx-auto">
            This page identifies adhoc magnets — engineers who consistently absorb unplanned work.
            That's an organizational insight, not a performance metric.
            The right response is documentation, runbooks, or self-serve tooling.
          </p>
        </div>
      </main>
    </div>
  )
}
