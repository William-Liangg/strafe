'use client'

import { TrendingUp, TrendingDown, Minus, Users } from 'lucide-react'
import { useEngineers } from '@/lib/hooks'

function getInitials(name: string) {
  return name.split(' ').map((p) => p[0]).join('').toUpperCase().slice(0, 2)
}

function getEngineerKey(
  eng: {
    engineer_slack_id: string | null
    engineer_name: string
    adhoc_points: number
    planned_points: number
  },
  index: number,
) {
  return `${eng.engineer_slack_id ?? 'unknown'}:${eng.engineer_name}:${eng.adhoc_points}:${eng.planned_points}:${index}`
}

function PageSkeleton() {
  return (
    <div className="p-8 space-y-6">
      {[1, 2, 3].map((i) => (
        <div key={i} className="animate-pulse bg-[#ebf0e0] rounded-3xl h-32" />
      ))}
    </div>
  )
}

function PageError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="p-8">
      <div className="bg-white rounded-3xl p-6 flex items-center gap-4 shadow-[0px_2px_32px_rgba(45,53,38,0.04)]">
        <div className="w-1.5 h-1.5 rounded-full bg-[#9f403d] shrink-0" />
        <p className="flex-1 text-[#9f403d] text-sm font-medium">{message}</p>
        <button
          onClick={onRetry}
          className="px-4 py-2 text-white text-sm font-semibold rounded-2xl transition-opacity hover:opacity-90"
          style={{ fontFamily: 'var(--font-manrope)', background: 'linear-gradient(180deg, #5f5e5e 0%, #535252 100%)' }}
        >
          Retry
        </button>
      </div>
    </div>
  )
}

function TrendIcon({ trend }: { trend: 'up' | 'down' | 'flat' }) {
  if (trend === 'up') return <TrendingUp className="h-3.5 w-3.5 text-[#9f403d]" />
  if (trend === 'down') return <TrendingDown className="h-3.5 w-3.5 text-[#3a6b4a]" />
  return <Minus className="h-3.5 w-3.5 text-[#b8c4a8]" />
}

export default function EngineersPage() {
  const { data, error, mutate } = useEngineers()

  if (!data && !error) return <PageSkeleton />
  if (error) return <PageError message={error.message || 'Failed to load engineer data'} onRetry={() => mutate()} />

  const engineers = data?.engineers ?? []
  const stats = data?.team_stats

  const maxAdhocPoints = Math.max(...engineers.map((e) => e.adhoc_points), 1)

  return (
    <div className="flex flex-col min-h-screen bg-[#f9faf0]">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-[#f9faf0]/80 backdrop-blur-[20px] px-8 py-4 shadow-[0px_1px_0px_rgba(184,196,168,0.3)]">
        <div className="flex items-center justify-between">
          <div>
            <h1
              className="text-2xl font-bold tracking-tight text-[#2d3526]"
              style={{ fontFamily: 'var(--font-manrope)', letterSpacing: '-0.02em' }}
            >
              Team Workload
            </h1>
            <p className="text-sm text-[#757d6b] mt-0.5">
              Who is being pulled away from planned work?
            </p>
          </div>
          <button
            onClick={() => mutate()}
            className="px-5 py-2 text-white text-sm font-semibold rounded-2xl transition-opacity hover:opacity-90"
            style={{ fontFamily: 'var(--font-manrope)', background: 'linear-gradient(180deg, #5f5e5e 0%, #535252 100%)' }}
          >
            Refresh
          </button>
        </div>
      </header>

      <main className="flex-1 p-8 space-y-8">
        {/* Team Health Snapshot */}
        <section className="grid grid-cols-3 gap-5">
          <div className="bg-white rounded-3xl p-6 shadow-[0px_2px_32px_rgba(45,53,38,0.04)]">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-1.5 h-1.5 rounded-full bg-[#5f5e5e]" />
              <p className="text-[10px] font-semibold text-[#757d6b] uppercase tracking-widest" style={{ fontFamily: 'var(--font-manrope)' }}>
                Total Adhoc Points This Sprint
              </p>
            </div>
            <p
              className="text-5xl font-bold text-[#2d3526]"
              style={{ fontFamily: 'var(--font-manrope)', letterSpacing: '-0.02em' }}
            >
              {stats?.total_adhoc_points ?? 0}
            </p>
            <p className="text-xs text-[#757d6b] mt-2">
              Story points absorbed by unplanned work
            </p>
          </div>

          <div className="bg-white rounded-3xl p-6 shadow-[0px_2px_32px_rgba(45,53,38,0.04)]">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-1.5 h-1.5 rounded-full bg-[#9f403d]" />
              <p className="text-[10px] font-semibold text-[#757d6b] uppercase tracking-widest" style={{ fontFamily: 'var(--font-manrope)' }}>
                Most Impacted Engineer
              </p>
            </div>
            <p
              className="text-3xl font-bold text-[#9f403d]"
              style={{ fontFamily: 'var(--font-manrope)', letterSpacing: '-0.01em' }}
            >
              {stats?.most_impacted_name ?? '—'}
            </p>
            <p className="text-sm text-[#2d3526] mt-1 font-medium">
              {stats?.most_impacted_points ?? 0} pts unplanned
            </p>
          </div>

          <div className="bg-white rounded-3xl p-6 shadow-[0px_2px_32px_rgba(45,53,38,0.04)]">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-1.5 h-1.5 rounded-full bg-[#b8c4a8]" />
              <p className="text-[10px] font-semibold text-[#757d6b] uppercase tracking-widest" style={{ fontFamily: 'var(--font-manrope)' }}>
                Team Adhoc Coverage
              </p>
            </div>
            <p
              className="text-5xl font-bold text-[#2d3526]"
              style={{ fontFamily: 'var(--font-manrope)', letterSpacing: '-0.02em' }}
            >
              {stats?.pct_carrying_adhoc ?? 0}%
            </p>
            <p className="text-xs text-[#757d6b] mt-2">
              {stats?.engineers_with_adhoc ?? 0} of {stats?.total_engineers ?? 0} engineers carrying adhoc
            </p>
          </div>
        </section>

        {/* Engineer Cards */}
        <section>
          <div className="flex items-center gap-3 mb-6">
            <Users className="h-5 w-5 text-[#757d6b]" />
            <h2
              className="text-lg font-bold text-[#2d3526]"
              style={{ fontFamily: 'var(--font-manrope)' }}
            >
              Individual Workload
            </h2>
          </div>

          {engineers.length === 0 ? (
            <div className="bg-white rounded-3xl p-8 text-center text-[#757d6b] text-sm shadow-[0px_2px_32px_rgba(45,53,38,0.04)]">
              No engineer data for current sprint
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-5">
              {engineers.map((eng, index) => (
                <div
                  key={getEngineerKey(eng, index)}
                  className="bg-white rounded-3xl p-6 shadow-[0px_2px_32px_rgba(45,53,38,0.04)]"
                >
                  {/* Header row */}
                  <div className="flex items-start justify-between mb-5">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-11 h-11 rounded-2xl bg-[#f2f5e8] flex items-center justify-center font-semibold text-[#2d3526] text-sm shrink-0"
                        style={{ fontFamily: 'var(--font-manrope)' }}
                      >
                        {getInitials(eng.engineer_name)}
                      </div>
                      <div>
                        <h3
                          className="text-base font-bold text-[#2d3526]"
                          style={{ fontFamily: 'var(--font-manrope)' }}
                        >
                          {eng.engineer_name}
                        </h3>
                        {eng.top_domain && (
                          <p className="text-xs text-[#757d6b] mt-0.5">{eng.top_domain}</p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <TrendIcon trend={eng.trend} />
                      <span
                        className={`text-xs font-medium ${
                          eng.trend === 'up' ? 'text-[#9f403d]' : eng.trend === 'down' ? 'text-[#3a6b4a]' : 'text-[#b8c4a8]'
                        }`}
                      >
                        {eng.trend === 'up' ? 'Rising' : eng.trend === 'down' ? 'Falling' : 'Stable'}
                      </span>
                    </div>
                  </div>

                  {/* Adhoc load */}
                  <div className="mb-5 p-4 bg-[#f9faf0] rounded-2xl">
                    <div className="flex items-baseline justify-between mb-1">
                      <span className="text-xs text-[#757d6b] font-medium">Adhoc Load</span>
                      <span
                        className={`text-2xl font-bold ${
                          eng.adhoc_percentage >= 50 ? 'text-[#9f403d]' : eng.adhoc_percentage >= 25 ? 'text-[#a07842]' : 'text-[#3a6b4a]'
                        }`}
                        style={{ fontFamily: 'var(--font-manrope)', letterSpacing: '-0.01em' }}
                      >
                        {eng.adhoc_percentage}%
                      </span>
                    </div>
                    <div className="h-1 bg-[#ebf0e0] rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          eng.adhoc_percentage >= 50 ? 'bg-[#9f403d]' : eng.adhoc_percentage >= 25 ? 'bg-[#a07842]' : 'bg-[#3a6b4a]'
                        }`}
                        style={{ width: `${eng.adhoc_percentage}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-[#757d6b] mt-1.5">of their sprint is unplanned work</p>
                  </div>

                  {/* Ticket breakdown */}
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-[10px] text-[#757d6b] uppercase tracking-widest font-semibold mb-1" style={{ fontFamily: 'var(--font-manrope)' }}>Adhoc</p>
                      <p className="font-semibold text-[#2d3526]">
                        {eng.adhoc_tickets} tickets
                        <span className="text-[#5f5e5e] ml-1.5">{eng.adhoc_points} pts</span>
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-[#757d6b] uppercase tracking-widest font-semibold mb-1" style={{ fontFamily: 'var(--font-manrope)' }}>Planned</p>
                      <p className="font-semibold text-[#2d3526]">
                        {eng.planned_tickets} tickets
                        <span className="text-[#757d6b] ml-1.5">{eng.planned_points} pts</span>
                      </p>
                    </div>
                  </div>

                  {eng.last_sprint_adhoc_points > 0 && (
                    <p className="text-xs text-[#757d6b] mt-4 pt-4 border-t border-[#b8c4a8]/20">
                      Last sprint: {eng.last_sprint_adhoc_points} adhoc pts
                      {eng.adhoc_points > eng.last_sprint_adhoc_points && (
                        <span className="text-[#9f403d] ml-1">
                          (+{eng.adhoc_points - eng.last_sprint_adhoc_points})
                        </span>
                      )}
                      {eng.adhoc_points < eng.last_sprint_adhoc_points && (
                        <span className="text-[#3a6b4a] ml-1">
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

        {/* Adhoc Load Distribution */}
        {engineers.length > 0 && (
          <section>
            <h2
              className="text-base font-bold text-[#2d3526] mb-4"
              style={{ fontFamily: 'var(--font-manrope)' }}
            >
              Adhoc Load Distribution
            </h2>
            <div className="bg-white rounded-3xl p-6 shadow-[0px_2px_32px_rgba(45,53,38,0.04)]">
              <div className="space-y-4">
                {engineers.map((eng, i) => {
                  const widthPct = (eng.adhoc_points / maxAdhocPoints) * 100
                  const isHighest = i === 0 && eng.adhoc_points > 0

                  return (
                    <div key={getEngineerKey(eng, i)} className="flex items-center gap-4">
                      <div className="w-24 shrink-0">
                        <span className={`text-sm font-medium ${isHighest ? 'text-[#9f403d]' : 'text-[#757d6b]'}`}>
                          {eng.engineer_name.split(' ')[0]}
                        </span>
                      </div>
                      <div className="flex-1 h-1.5 bg-[#f2f5e8] rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${isHighest ? 'bg-[#9f403d]' : 'bg-[#5f5e5e]'}`}
                          style={{ width: `${Math.max(widthPct, 2)}%` }}
                        />
                      </div>
                      <div className="w-14 text-right">
                        <span className={`text-sm font-semibold ${isHighest ? 'text-[#9f403d]' : 'text-[#757d6b]'}`} style={{ fontFamily: 'var(--font-manrope)' }}>
                          {eng.adhoc_points} pts
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>

              {engineers.length > 1 && engineers[0].adhoc_points > 0 && (
                (() => {
                  const top = engineers[0].adhoc_points
                  const second = engineers[1]?.adhoc_points ?? 0
                  const ratio = second > 0 ? top / second : top

                  if (ratio >= 2) {
                    return (
                      <div className="mt-6 pt-5 border-t border-[#b8c4a8]/20 flex items-start gap-3">
                        <div className="w-1.5 h-1.5 rounded-full bg-[#9f403d] mt-1 shrink-0" />
                        <div>
                          <p className="text-sm font-semibold text-[#9f403d]" style={{ fontFamily: 'var(--font-manrope)' }}>
                            Concentration Risk Detected
                          </p>
                          <p className="text-xs text-[#757d6b] mt-1">
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
        <div className="text-center py-8">
          <p className="text-xs text-[#757d6b] max-w-xl mx-auto leading-relaxed">
            This page identifies adhoc magnets — engineers who consistently absorb unplanned work.
            That&apos;s an organizational insight, not a performance metric.
            The right response is documentation, runbooks, or self-serve tooling.
          </p>
        </div>
      </main>
    </div>
  )
}
