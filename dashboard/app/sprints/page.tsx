'use client'

import { format } from 'date-fns'
import { Calendar, CheckCircle, Clock, AlertTriangle } from 'lucide-react'
import { useSprints } from '@/lib/hooks'
import { CardSkeleton } from '@/components/LoadingSkeleton'
import { ErrorState } from '@/components/ErrorState'

function getStateIcon(state: string) {
  switch (state) {
    case 'active':
      return <Clock className="h-4 w-4 text-blue-500" />
    case 'closed':
      return <CheckCircle className="h-4 w-4 text-green-500" />
    default:
      return <Calendar className="h-4 w-4 text-gray-400" />
  }
}

function getStateLabel(state: string) {
  switch (state) {
    case 'active':
      return 'Active'
    case 'closed':
      return 'Completed'
    case 'future':
      return 'Planned'
    default:
      return state
  }
}

export default function SprintsPage() {
  const { data, error, mutate } = useSprints()

  const isLoading = !data && !error
  const sprints = data?.sprints ?? []

  // Sort sprints: active first, then by start date descending
  const sortedSprints = [...sprints].sort((a, b) => {
    if (a.state === 'active' && b.state !== 'active') return -1
    if (b.state === 'active' && a.state !== 'active') return 1
    return new Date(b.start_date ?? '').getTime() - new Date(a.start_date ?? '').getTime()
  })

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Sprints</h1>

      {isLoading ? (
        <div className="grid grid-cols-2 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      ) : error ? (
        <ErrorState onRetry={() => mutate()} />
      ) : sortedSprints.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          No sprints found
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-6">
          {sortedSprints.map((sprint) => {
            const totalTickets = sprint.adhoc_count + sprint.planned_count
            const adhocWidth = totalTickets > 0
              ? (sprint.adhoc_count / totalTickets) * 100
              : 0
            const isHighAdhoc = sprint.adhoc_percentage > 30

            return (
              <div
                key={sprint.sprint_id}
                className={`bg-white rounded-lg shadow-sm p-6 ${
                  sprint.state === 'active' ? 'ring-2 ring-blue-500' : ''
                }`}
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      {sprint.sprint_name}
                    </h3>
                    <div className="flex items-center gap-2 mt-1">
                      {getStateIcon(sprint.state)}
                      <span className="text-sm text-gray-600">
                        {getStateLabel(sprint.state)}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    {sprint.start_date && sprint.end_date && (
                      <div className="text-sm text-gray-500">
                        {format(new Date(sprint.start_date), 'MMM d')} -{' '}
                        {format(new Date(sprint.end_date), 'MMM d, yyyy')}
                      </div>
                    )}
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div>
                    <div className="text-2xl font-bold text-gray-900">
                      {totalTickets}
                    </div>
                    <div className="text-xs text-gray-500">Total tickets</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-[#E2534A]">
                      {sprint.adhoc_count}
                    </div>
                    <div className="text-xs text-gray-500">Adhoc</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-green-600">
                      {sprint.planned_count}
                    </div>
                    <div className="text-xs text-gray-500">Planned</div>
                  </div>
                </div>

                {/* Adhoc Percentage */}
                <div className="mb-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-gray-600">Adhoc percentage</span>
                    <span
                      className={`text-sm font-medium ${
                        isHighAdhoc ? 'text-[#E2534A]' : 'text-gray-900'
                      }`}
                    >
                      {sprint.adhoc_percentage.toFixed(1)}%
                      {isHighAdhoc && (
                        <AlertTriangle className="inline h-3 w-3 ml-1" />
                      )}
                    </span>
                  </div>
                  {/* Progress bar */}
                  <div className="h-2 bg-green-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#E2534A] rounded-full transition-all"
                      style={{ width: `${adhocWidth}%` }}
                    />
                  </div>
                  <div className="flex justify-between mt-1">
                    <span className="text-xs text-[#E2534A]">Adhoc</span>
                    <span className="text-xs text-green-600">Planned</span>
                  </div>
                </div>

                {/* Points (if available) */}
                {(sprint.total_story_points_adhoc > 0 || sprint.total_story_points_planned > 0) && (
                  <div className="pt-3 border-t border-gray-100">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Story points</span>
                      <span className="text-gray-900">
                        {sprint.total_story_points_adhoc + sprint.total_story_points_planned} total
                        <span className="text-gray-400 ml-1">
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
    </div>
  )
}
