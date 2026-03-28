'use client'

import { User, Zap, Ticket } from 'lucide-react'
import { useEngineers } from '@/lib/hooks'
import { CardSkeleton } from '@/components/LoadingSkeleton'
import { ErrorState } from '@/components/ErrorState'
import { getInitials, stringToColor } from '@/lib/utils'

export default function EngineersPage() {
  const { data, error, mutate } = useEngineers()

  const isLoading = !data && !error
  const engineers = data?.engineers ?? []

  // Calculate max points for load bar scaling
  const maxPoints = Math.max(
    ...(engineers.length > 0 ? engineers.map((e) => e.adhoc_points) : [1])
  )

  // Sort engineers by adhoc points descending
  const sortedEngineers = [...engineers].sort(
    (a, b) => b.adhoc_points - a.adhoc_points
  )

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Engineers</h1>

      {isLoading ? (
        <div className="grid grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      ) : error ? (
        <ErrorState onRetry={() => mutate()} />
      ) : sortedEngineers.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          No engineers found
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-6">
          {sortedEngineers.map((engineer, index) => {
            const loadPercentage = maxPoints > 0
              ? (engineer.adhoc_points / maxPoints) * 100
              : 0
            const isTopLoad = index === 0 && engineer.adhoc_points > 0
            const avatarColor = stringToColor(engineer.engineer_name)

            return (
              <div
                key={engineer.engineer_slack_id || engineer.engineer_name}
                className={`bg-white rounded-lg shadow-sm p-6 ${
                  isTopLoad ? 'ring-2 ring-[#E2534A]' : ''
                }`}
              >
                {/* Header with avatar */}
                <div className="flex items-center gap-4 mb-4">
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center text-white font-semibold text-lg"
                    style={{ backgroundColor: avatarColor }}
                  >
                    {getInitials(engineer.engineer_name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-semibold text-gray-900 truncate">
                      {engineer.engineer_name}
                    </h3>
                    {isTopLoad && (
                      <span className="inline-flex items-center gap-1 text-xs text-[#E2534A] font-medium">
                        Highest adhoc load
                      </span>
                    )}
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="flex items-center gap-2">
                    <Ticket className="h-4 w-4 text-gray-400" />
                    <div>
                      <div className="text-xl font-bold text-gray-900">
                        {engineer.adhoc_tickets}
                      </div>
                      <div className="text-xs text-gray-500">Adhoc tickets</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Zap className="h-4 w-4 text-gray-400" />
                    <div>
                      <div className="text-xl font-bold text-[#E2534A]">
                        {engineer.adhoc_points}
                      </div>
                      <div className="text-xs text-gray-500">Adhoc points</div>
                    </div>
                  </div>
                </div>

                {/* Load bar */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-gray-500">Adhoc load</span>
                    <span className="text-xs font-medium text-gray-700">
                      {loadPercentage.toFixed(0)}% of max
                    </span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#E2534A] rounded-full transition-all"
                      style={{ width: `${loadPercentage}%` }}
                    />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Summary Stats */}
      {!isLoading && !error && sortedEngineers.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-sm font-medium text-gray-700 mb-4">
            Team Summary
          </h2>
          <div className="grid grid-cols-4 gap-6">
            <div>
              <div className="text-3xl font-bold text-gray-900">
                {sortedEngineers.length}
              </div>
              <div className="text-sm text-gray-500">Engineers</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-gray-900">
                {sortedEngineers.reduce((sum, e) => sum + e.adhoc_tickets, 0)}
              </div>
              <div className="text-sm text-gray-500">Total adhoc tickets</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-[#E2534A]">
                {sortedEngineers.reduce((sum, e) => sum + e.adhoc_points, 0)}
              </div>
              <div className="text-sm text-gray-500">Total adhoc points</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-gray-900">
                {(
                  sortedEngineers.reduce((sum, e) => sum + e.adhoc_points, 0) /
                  sortedEngineers.length
                ).toFixed(1)}
              </div>
              <div className="text-sm text-gray-500">Avg points per engineer</div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
