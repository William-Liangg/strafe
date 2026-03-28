'use client'

import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts'
import { useChannels } from '@/lib/hooks'
import { CardSkeleton, TableSkeleton } from '@/components/LoadingSkeleton'
import { ErrorState } from '@/components/ErrorState'
import { stringToColor } from '@/lib/utils'

export default function ChannelsPage() {
  const { data, error, mutate } = useChannels()

  const isLoading = !data && !error
  const channels = data?.channels ?? []

  // Calculate total for percentage
  const totalCount = channels.reduce((sum, c) => sum + c.count, 0)

  // Prepare pie chart data
  const pieData = channels.map((channel) => ({
    name: channel.channel_name,
    value: channel.count,
    percentage: totalCount > 0 ? ((channel.count / totalCount) * 100).toFixed(1) : '0',
  }))

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Channels</h1>

      <div className="grid grid-cols-2 gap-6">
        {/* Pie Chart */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-sm font-medium text-gray-700 mb-4">
            Ticket distribution by channel
          </h2>
          {isLoading ? (
            <div className="h-[300px] bg-gray-100 rounded animate-pulse" />
          ) : error ? (
            <ErrorState onRetry={() => mutate()} />
          ) : channels.length === 0 ? (
            <div className="h-[300px] flex items-center justify-center text-gray-500">
              No channel data available
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={2}
                  dataKey="value"
                  label={({ name, payload }) => `${name} (${payload?.percentage ?? 0}%)`}
                  labelLine={{ stroke: '#94a3b8', strokeWidth: 1 }}
                >
                  {pieData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={stringToColor(entry.name)}
                    />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'white',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                  formatter={(value) => [`${value} tickets`]}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Stats Summary */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-sm font-medium text-gray-700 mb-4">
            Channel summary
          </h2>
          {isLoading ? (
            <CardSkeleton />
          ) : error ? (
            <ErrorState onRetry={() => mutate()} />
          ) : (
            <div className="space-y-6">
              <div>
                <div className="text-4xl font-bold text-gray-900">
                  {channels.length}
                </div>
                <div className="text-sm text-gray-500">Active channels</div>
              </div>
              <div>
                <div className="text-4xl font-bold text-gray-900">
                  {totalCount}
                </div>
                <div className="text-sm text-gray-500">Total tickets from channels</div>
              </div>
              {channels.length > 0 && (
                <div>
                  <div className="text-lg font-semibold text-[#E2534A]">
                    #{channels[0].channel_name}
                  </div>
                  <div className="text-sm text-gray-500">
                    Top source ({channels[0].count} tickets)
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Channel Table */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-sm font-medium text-gray-700">
            All channels
          </h2>
        </div>
        {isLoading ? (
          <div className="p-6">
            <TableSkeleton rows={5} />
          </div>
        ) : error ? (
          <div className="p-6">
            <ErrorState onRetry={() => mutate()} />
          </div>
        ) : channels.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            No channels found
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Channel
                </th>
                <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Ticket Count
                </th>
                <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Percentage
                </th>
                <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide w-48">
                  Distribution
                </th>
              </tr>
            </thead>
            <tbody>
              {channels.map((channel, index) => {
                const percentage = totalCount > 0
                  ? (channel.count / totalCount) * 100
                  : 0

                return (
                  <tr
                    key={channel.channel_name}
                    className={`border-b border-gray-100 ${
                      index === 0 ? 'bg-red-50/50' : ''
                    }`}
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: stringToColor(channel.channel_name) }}
                        />
                        <span className="text-sm font-medium text-gray-900">
                          #{channel.channel_name}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="text-sm text-gray-900 font-medium">
                        {channel.count}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="text-sm text-gray-600">
                        {percentage.toFixed(1)}%
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${percentage}%`,
                            backgroundColor: stringToColor(channel.channel_name),
                          }}
                        />
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
