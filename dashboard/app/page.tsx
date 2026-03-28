'use client'

import { useState } from 'react'
import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import {
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Cell,
} from 'recharts'
import { ArrowRight } from 'lucide-react'
import { useSummary, useTickets } from '@/lib/hooks'
import { StatCard, StatCardSkeleton } from '@/components/StatCard'
import { StatusBadge } from '@/components/TicketBadge'
import { TicketRowSkeleton } from '@/components/LoadingSkeleton'
import { ErrorState } from '@/components/ErrorState'
import { TicketDetailPanel } from '@/components/TicketDetailPanel'
import type { Ticket } from '@/lib/types'

export default function DashboardPage() {
  const { data: summary, error: summaryError, mutate: mutateSummary } = useSummary()
  const { data: ticketsData, error: ticketsError, mutate: mutateTickets } = useTickets()
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null)

  const isLoading = !summary && !summaryError
  const isTicketsLoading = !ticketsData && !ticketsError

  // Prepare trend data for chart
  const trendData = summary?.trend.map((item) => ({
    name: item.sprint_name,
    adhocPercentage: item.adhoc_percentage,
    totalTickets: item.adhoc_count + item.planned_count,
  })) || []

  // Prepare channel data for horizontal bar chart
  const channelData = summary?.top_source_channels || []

  // Get max adhoc points for engineer load calculation
  const maxAdhocPoints = Math.max(
    ...(summary?.top_engineers_adhoc_load.map((e) => e.adhoc_points) || [1])
  )

  // Get recent tickets (last 5)
  const recentTickets = ticketsData?.tickets.slice(0, 5) || []

  const handleTicketUpdate = () => {
    mutateTickets()
    mutateSummary()
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>

      {/* Stat Cards */}
      <div className="grid grid-cols-4 gap-4">
        {isLoading ? (
          <>
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
          </>
        ) : summaryError ? (
          <div className="col-span-4">
            <ErrorState onRetry={() => mutateSummary()} />
          </div>
        ) : summary?.current_sprint ? (
          <>
            <StatCard
              value={`${summary.current_sprint.adhoc_percentage}%`}
              label="adhoc this sprint"
              sublabel={
                summary.comparison_to_last_sprint
                  ? summary.comparison_to_last_sprint.direction === 'down'
                    ? `↓ ${Math.abs(summary.comparison_to_last_sprint.difference)}% vs last sprint`
                    : summary.comparison_to_last_sprint.direction === 'up'
                    ? `↑ ${summary.comparison_to_last_sprint.difference}% vs last sprint`
                    : 'same as last sprint'
                  : undefined
              }
              borderColor="#E2534A"
            />
            <StatCard
              value={summary.current_sprint.adhoc_count}
              label="unplanned tickets"
              sublabel={`of ${summary.current_sprint.total_count} total this sprint`}
              borderColor="#E2534A"
            />
            <StatCard
              value={summary.current_sprint.top_source_channel || 'N/A'}
              label="top source channel"
              sublabel={
                summary.top_source_channels[0]
                  ? `${summary.top_source_channels[0].count} tickets`
                  : undefined
              }
              borderColor="#F59E0B"
            />
            <StatCard
              value={(100 - summary.current_sprint.adhoc_percentage).toFixed(1)}
              label="health score"
              sublabel={`${summary.current_sprint.sprint_name} · ${summary.current_sprint.state}`}
              borderColor="#22C55E"
            />
          </>
        ) : (
          <div className="col-span-4 text-center py-8 text-gray-500">
            No active sprint found
          </div>
        )}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-2 gap-6">
        {/* Trend Chart */}
        <div className="bg-white rounded-lg p-5 shadow-sm">
          <h2 className="text-sm font-medium text-gray-700 mb-4">
            Adhoc trend across sprints
          </h2>
          {isLoading ? (
            <div className="h-[280px] bg-gray-100 rounded animate-pulse" />
          ) : summaryError ? (
            <ErrorState onRetry={() => mutateSummary()} />
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <ComposedChart data={trendData}>
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  axisLine={{ stroke: '#e5e7eb' }}
                />
                <YAxis
                  yAxisId="left"
                  domain={[0, 100]}
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  axisLine={{ stroke: '#e5e7eb' }}
                  tickFormatter={(v) => `${v}%`}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  axisLine={{ stroke: '#e5e7eb' }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'white',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                  formatter={(value, name) => {
                    if (name === 'adhocPercentage') return [`${value}%`, 'Adhoc %']
                    return [value, 'Total tickets']
                  }}
                />
                <Legend
                  verticalAlign="bottom"
                  height={36}
                  formatter={(value) =>
                    value === 'adhocPercentage' ? 'Adhoc %' : 'Total tickets'
                  }
                />
                <Bar
                  yAxisId="right"
                  dataKey="totalTickets"
                  fill="#e5e7eb"
                  opacity={0.5}
                  radius={[4, 4, 0, 0]}
                />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="adhocPercentage"
                  stroke="#E2534A"
                  strokeWidth={2}
                  dot={{ fill: '#E2534A', strokeWidth: 2, r: 4 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Channel Bar Chart */}
        <div className="bg-white rounded-lg p-5 shadow-sm">
          <h2 className="text-sm font-medium text-gray-700 mb-4">
            Requests by channel
          </h2>
          {isLoading ? (
            <div className="h-[280px] bg-gray-100 rounded animate-pulse" />
          ) : summaryError ? (
            <ErrorState onRetry={() => mutateSummary()} />
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart
                data={channelData}
                layout="vertical"
                margin={{ left: 20, right: 40 }}
              >
                <XAxis type="number" tick={{ fontSize: 12 }} />
                <YAxis
                  type="category"
                  dataKey="channel_name"
                  tick={{ fontSize: 12 }}
                  width={120}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'white',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                />
                <Bar dataKey="count" fill="#E2534A" radius={[0, 4, 4, 0]}>
                  {channelData.map((_, index) => (
                    <Cell key={`cell-${index}`} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-2 gap-6">
        {/* Engineer Load Table */}
        <div className="bg-white rounded-lg p-5 shadow-sm">
          <h2 className="text-sm font-medium text-gray-700 mb-4">
            Engineer adhoc load · {summary?.current_sprint?.sprint_name || 'Current Sprint'}
          </h2>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex gap-4">
                  <div className="h-4 flex-1 bg-gray-200 rounded animate-pulse" />
                  <div className="h-4 w-16 bg-gray-200 rounded animate-pulse" />
                  <div className="h-4 w-16 bg-gray-200 rounded animate-pulse" />
                  <div className="h-4 w-24 bg-gray-200 rounded animate-pulse" />
                </div>
              ))}
            </div>
          ) : summaryError ? (
            <ErrorState onRetry={() => mutateSummary()} />
          ) : (
            <table className="w-full">
              <thead>
                <tr className="text-xs text-gray-500 uppercase tracking-wide">
                  <th className="text-left pb-3 font-medium">Engineer</th>
                  <th className="text-right pb-3 font-medium">Tickets</th>
                  <th className="text-right pb-3 font-medium">Points</th>
                  <th className="text-right pb-3 font-medium w-32">Load</th>
                </tr>
              </thead>
              <tbody>
                {summary?.top_engineers_adhoc_load.map((engineer, index) => (
                  <tr
                    key={engineer.engineer_slack_id || engineer.engineer_name}
                    className={index === 0 ? 'bg-red-50/50' : ''}
                  >
                    <td className="py-3 border-b border-gray-100 text-sm font-medium">
                      {engineer.engineer_name}
                    </td>
                    <td className="py-3 border-b border-gray-100 text-sm text-right text-gray-600">
                      {engineer.adhoc_tickets}
                    </td>
                    <td className="py-3 border-b border-gray-100 text-sm text-right text-gray-600">
                      {engineer.adhoc_points}
                    </td>
                    <td className="py-3 border-b border-gray-100">
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#E2534A] rounded-full"
                          style={{
                            width: `${(engineer.adhoc_points / maxAdhocPoints) * 100}%`,
                          }}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Recent Tickets */}
        <div className="bg-white rounded-lg p-5 shadow-sm">
          <h2 className="text-sm font-medium text-gray-700 mb-4">
            Recent tickets
          </h2>
          {isTicketsLoading ? (
            <div className="space-y-0">
              {[1, 2, 3, 4, 5].map((i) => (
                <TicketRowSkeleton key={i} />
              ))}
            </div>
          ) : ticketsError ? (
            <ErrorState onRetry={() => mutateTickets()} />
          ) : (
            <>
              <div className="space-y-0">
                {recentTickets.map((ticket) => (
                  <button
                    key={ticket.id}
                    onClick={() => setSelectedTicket(ticket)}
                    className="w-full flex items-center gap-3 py-3 border-b border-gray-100 hover:bg-gray-50 text-left transition-colors"
                  >
                    <StatusBadge status={ticket.status} />
                    <span className="flex-1 text-sm font-medium text-gray-900 truncate">
                      {ticket.title}
                    </span>
                    <span className="text-xs text-gray-500">
                      {ticket.source_channel_name}
                    </span>
                    <span className="text-xs text-gray-400">
                      {formatDistanceToNow(new Date(ticket.created_at), {
                        addSuffix: true,
                      })}
                    </span>
                  </button>
                ))}
              </div>
              <Link
                href="/tickets"
                className="inline-flex items-center gap-1 mt-4 text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                View all tickets <ArrowRight className="h-4 w-4" />
              </Link>
            </>
          )}
        </div>
      </div>

      {/* Ticket Detail Panel */}
      {selectedTicket && (
        <TicketDetailPanel
          ticket={selectedTicket}
          onClose={() => setSelectedTicket(null)}
          onUpdate={handleTicketUpdate}
        />
      )}
    </div>
  )
}
