'use client'

import { format } from 'date-fns'
import { Calendar, CheckCircle, Clock, AlertTriangle } from 'lucide-react'
import { useSprints } from '@/lib/hooks'
import { CardSkeleton } from '@/components/LoadingSkeleton'
import { ErrorState } from '@/components/ErrorState'

function getStateIcon(state: string) {
  switch (state) {
    case 'active':
      return <Clock className="h-3.5 w-3.5 text-[#5f5e5e]" />
    case 'closed':
      return <CheckCircle className="h-3.5 w-3.5 text-[#3a6b4a]" />
    default:
      return <Calendar className="h-3.5 w-3.5 text-[#b8c4a8]" />
  }
}

function getStateLabel(state: string) {
  switch (state) {
    case 'active': return 'Active'
    case 'closed': return 'Completed'
    case 'future': return 'Planned'
    default: return state
  }
}

export default function SprintsPage() {
  const { data, error, mutate } = useSprints()

  const isLoading = !data && !error
  const sprints = data?.sprints ?? []

  const sortedSprints = [...sprints].sort((a, b) => {
    if (a.state === 'active' && b.state !== 'active') return -1
    if (b.state === 'active' && a.state !== 'active') return 1
    return new Date(b.start_date ?? '').getTime() - new Date(a.start_date ?? '').getTime()
  })

  return (
    <div className="flex flex-col min-h-screen bg-[#f9faf0]">
      <header className="sticky top-0 z-30 bg-[#f9faf0]/80 backdrop-blur-[20px] px-8 py-4 shadow-[0px_1px_0px_rgba(184,196,168,0.3)]">
        <h1
          className="text-2xl font-bold tracking-tight text-[#2d3526]"
          style={{ fontFamily: 'var(--font-manrope)', letterSpacing: '-0.02em' }}
        >
          Sprints
        </h1>
      </header>

      <main className="flex-1 p-8">
        {isLoading ? (
          <div className="grid grid-cols-2 gap-5">
            {[1, 2, 3, 4].map((i) => (
              <CardSkeleton key={i} />
            ))}
          </div>
        ) : error ? (
          <ErrorState onRetry={() => mutate()} />
        ) : sortedSprints.length === 0 ? (
          <div className="text-center py-12 text-[#757d6b] text-sm">
            No sprints found
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-5">
            {sortedSprints.map((sprint) => {
              const totalTickets = sprint.adhoc_count + sprint.planned_count
              const adhocWidth = totalTickets > 0
                ? (sprint.adhoc_count / totalTickets) * 100
                : 0
              const isHighAdhoc = sprint.adhoc_percentage > 30
              const isActive = sprint.state === 'active'

              return (
                <div
                  key={sprint.sprint_id}
                  className={[
                    'bg-white rounded-3xl p-6 shadow-[0px_2px_32px_rgba(45,53,38,0.04)]',
                    isActive ? 'ring-1 ring-[#5f5e5e]/20' : '',
                  ].join(' ')}
                >
                  {/* Header */}
                  <div className="flex items-start justify-between mb-5">
                    <div>
                      <h3
                        className="text-base font-bold text-[#2d3526]"
                        style={{ fontFamily: 'var(--font-manrope)' }}
                      >
                        {sprint.sprint_name}
                      </h3>
                      <div className="flex items-center gap-1.5 mt-1.5">
                        {getStateIcon(sprint.state)}
                        <span className="text-xs text-[#757d6b]">
                          {getStateLabel(sprint.state)}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      {sprint.start_date && sprint.end_date && (
                        <div className="text-xs text-[#757d6b]">
                          {format(new Date(sprint.start_date), 'MMM d')} –{' '}
                          {format(new Date(sprint.end_date), 'MMM d, yyyy')}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-3 gap-4 mb-5">
                    <div>
                      <div className="text-2xl font-bold text-[#2d3526]" style={{ fontFamily: 'var(--font-manrope)', letterSpacing: '-0.01em' }}>
                        {totalTickets}
                      </div>
                      <div className="text-[10px] text-[#757d6b] uppercase tracking-widest font-medium mt-0.5">Total</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-[#9f403d]" style={{ fontFamily: 'var(--font-manrope)', letterSpacing: '-0.01em' }}>
                        {sprint.adhoc_count}
                      </div>
                      <div className="text-[10px] text-[#757d6b] uppercase tracking-widest font-medium mt-0.5">Adhoc</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-[#3a6b4a]" style={{ fontFamily: 'var(--font-manrope)', letterSpacing: '-0.01em' }}>
                        {sprint.planned_count}
                      </div>
                      <div className="text-[10px] text-[#757d6b] uppercase tracking-widest font-medium mt-0.5">Planned</div>
                    </div>
                  </div>

                  {/* Adhoc Percentage */}
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-[#757d6b]">Adhoc percentage</span>
                      <div className="flex items-center gap-1.5">
                        {isHighAdhoc && <div className="w-1.5 h-1.5 rounded-full bg-[#9f403d]" />}
                        <span className={`text-sm font-semibold ${isHighAdhoc ? 'text-[#9f403d]' : 'text-[#2d3526]'}`} style={{ fontFamily: 'var(--font-manrope)' }}>
                          {sprint.adhoc_percentage.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                    <div className="h-1 bg-[#f2f5e8] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#9f403d] rounded-full transition-all"
                        style={{ width: `${adhocWidth}%` }}
                      />
                    </div>
                    <div className="flex justify-between mt-1.5">
                      <span className="text-[10px] text-[#9f403d]">Adhoc</span>
                      <span className="text-[10px] text-[#3a6b4a]">Planned</span>
                    </div>
                  </div>

                  {/* Points */}
                  {(sprint.total_story_points_adhoc > 0 || sprint.total_story_points_planned > 0) && (
                    <div className="pt-4 border-t border-[#b8c4a8]/20">
                      <div className="flex justify-between text-sm">
                        <span className="text-[#757d6b]">Story points</span>
                        <span className="text-[#2d3526] font-medium">
                          {sprint.total_story_points_adhoc + sprint.total_story_points_planned} total
                          <span className="text-[#757d6b] ml-1.5 text-xs">
                            ({sprint.total_story_points_adhoc} adhoc / {sprint.total_story_points_planned} planned)
                          </span>
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
