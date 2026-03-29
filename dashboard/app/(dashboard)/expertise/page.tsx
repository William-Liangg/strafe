'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as d3 from 'd3'
import { Circle, GitBranch, RefreshCw, Users } from 'lucide-react'
import { triggerExpertiseSync } from '@/lib/api'
import { useExpertiseGraph, useExpertiseSyncStatus } from '@/lib/hooks'
import type { ExpertiseNode, ExpertiseEdge } from '@/lib/types'

interface SimNode extends d3.SimulationNodeDatum, ExpertiseNode {
  radius: number
  color: string
}

interface SimLink extends d3.SimulationLinkDatum<SimNode> {
  shared_domains: string[]
  weight: number
}

interface TooltipState {
  x: number
  y: number
  node: ExpertiseNode
}

const GRAPH_COLORS = [
  '#5f5e5e',
  '#3a6b4a',
  '#a07842',
  '#9f403d',
  '#7b8b62',
  '#6c7a89',
  '#8b7355',
  '#6b7b57',
]

const COLOR_SCALE = d3.scaleOrdinal(GRAPH_COLORS)

function contributorInitials(name: string) {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

function domainScoreColor(score: number): string {
  if (score >= 0.8) return '#3a6b4a'
  if (score >= 0.5) return '#a07842'
  return '#757d6b'
}

function domainScoreBackground(score: number): string {
  if (score >= 0.8) return '#e6efe2'
  if (score >= 0.5) return '#f4ede1'
  return '#eef1e7'
}

function formatDate(iso: string | null): string {
  if (!iso) return 'Never'
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function syncStatusMeta(status: string) {
  switch (status) {
    case 'success':
      return { color: '#3a6b4a', bg: '#e6efe2', label: 'Synced' }
    case 'running':
      return { color: '#a07842', bg: '#f4ede1', label: 'Syncing' }
    case 'failed':
      return { color: '#9f403d', bg: '#f5e7e5', label: 'Needs Attention' }
    default:
      return { color: '#757d6b', bg: '#eef1e7', label: 'Not Synced' }
  }
}

function Tooltip({ tip }: { tip: TooltipState }) {
  return (
    <div
      className="pointer-events-none fixed z-50 max-w-xs rounded-2xl bg-white p-4 shadow-[0px_12px_40px_rgba(45,53,38,0.16)]"
      style={{ left: tip.x + 16, top: tip.y - 12 }}
    >
      <div className="mb-3 flex items-center gap-3">
        {tip.node.avatar_url ? (
          <img
            src={tip.node.avatar_url}
            alt={tip.node.name}
            className="h-10 w-10 rounded-2xl object-cover"
          />
        ) : (
          <div
            className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#f2f5e8] text-xs font-semibold text-[#2d3526]"
            style={{ fontFamily: 'var(--font-manrope)' }}
          >
            {contributorInitials(tip.node.name)}
          </div>
        )}
        <div className="min-w-0">
          <p
            className="truncate text-sm font-bold text-[#2d3526]"
            style={{ fontFamily: 'var(--font-manrope)' }}
          >
            {tip.node.github_login}
          </p>
          <p className="text-xs text-[#757d6b]">Top domain: {tip.node.top_domain}</p>
        </div>
      </div>
      <div className="space-y-2">
        {tip.node.expertise.slice(0, 5).map((domain) => (
          <div key={domain.domain}>
            <div className="mb-1 flex items-center justify-between gap-3">
              <span className="truncate text-xs font-medium text-[#2d3526]">{domain.domain}</span>
              <span className="shrink-0 text-[11px] text-[#757d6b]">
                {Math.round(domain.score * 100)}%
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-[#eef1e7]">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${Math.max(Math.round(domain.score * 100), 8)}%`,
                  backgroundColor: domainScoreColor(domain.score),
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function StatCard({
  label,
  value,
  caption,
  pipColor,
}: {
  label: string
  value: string
  caption: string
  pipColor: string
}) {
  return (
    <div className="rounded-3xl bg-white p-6 shadow-[0px_2px_32px_rgba(45,53,38,0.04)]">
      <div className="mb-3 flex items-center gap-2">
        <div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: pipColor }} />
        <p
          className="text-[10px] font-semibold uppercase tracking-widest text-[#757d6b]"
          style={{ fontFamily: 'var(--font-manrope)' }}
        >
          {label}
        </p>
      </div>
      <p
        className="text-5xl font-bold tracking-tight text-[#2d3526]"
        style={{ fontFamily: 'var(--font-manrope)', letterSpacing: '-0.02em' }}
      >
        {value}
      </p>
      <p className="mt-2 text-xs text-[#757d6b]">{caption}</p>
    </div>
  )
}

function ContributorCard({
  node,
  isSelected,
  onClick,
}: {
  node: ExpertiseNode
  isSelected: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={[
        'w-full rounded-3xl p-4 text-left transition-colors',
        isSelected
          ? 'bg-[#f2f5e8] shadow-[0px_1px_8px_rgba(45,53,38,0.06)]'
          : 'bg-[#f9faf0] hover:bg-[#f2f5e8]/70',
      ].join(' ')}
    >
      <div className="mb-3 flex items-center gap-3">
        {node.avatar_url ? (
          <img
            src={node.avatar_url}
            alt={node.name}
            className="h-11 w-11 rounded-2xl object-cover"
          />
        ) : (
          <div
            className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-sm font-semibold text-[#2d3526]"
            style={{ fontFamily: 'var(--font-manrope)' }}
          >
            {contributorInitials(node.name)}
          </div>
        )}
        <div className="min-w-0">
          <p
            className="truncate text-sm font-bold text-[#2d3526]"
            style={{ fontFamily: 'var(--font-manrope)' }}
          >
            {node.github_login}
          </p>
          <p className="truncate text-xs text-[#757d6b]">{node.top_domain}</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {node.expertise.slice(0, 3).map((domain) => (
          <span
            key={domain.domain}
            className="rounded-full px-2.5 py-1 text-[11px] font-medium"
            style={{
              backgroundColor: domainScoreBackground(domain.score),
              color: domainScoreColor(domain.score),
            }}
          >
            {domain.domain}
          </span>
        ))}
        {node.expertise.length > 3 && (
          <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-medium text-[#757d6b]">
            +{node.expertise.length - 3}
          </span>
        )}
      </div>
    </button>
  )
}

export default function ExpertisePage() {
  const { data: graph, error: graphError, mutate: refreshGraph } = useExpertiseGraph()
  const [syncing, setSyncing] = useState(false)
  const [selectedNode, setSelectedNode] = useState<string | null>(null)
  const [tooltip, setTooltip] = useState<TooltipState | null>(null)

  const { data: syncStatus, error: syncError, mutate: refreshStatus } = useExpertiseSyncStatus(syncing)

  useEffect(() => {
    if (syncStatus && syncStatus.status !== 'running' && syncing) {
      const timeoutId = window.setTimeout(() => {
        setSyncing(false)
      }, 0)
      void refreshGraph()
      return () => {
        window.clearTimeout(timeoutId)
      }
    }
  }, [syncStatus, syncing, refreshGraph])

  const handleSync = useCallback(async () => {
    setSyncing(true)
    try {
      await triggerExpertiseSync()
      void refreshStatus()
    } catch (error) {
      console.error('Sync failed to trigger:', error)
      setSyncing(false)
    }
  }, [refreshStatus])

  const svgRef = useRef<SVGSVGElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const nodes = useMemo<SimNode[]>(
    () =>
      (graph?.nodes ?? []).map((node: ExpertiseNode, index: number) => ({
        ...node,
        radius: 18 + node.expertise.length * 3,
        color: COLOR_SCALE(String(index)),
      })),
    [graph],
  )

  const links = useMemo<SimLink[]>(
    () =>
      (graph?.edges ?? []).map((edge: ExpertiseEdge) => ({
        source: edge.source,
        target: edge.target,
        shared_domains: edge.shared_domains,
        weight: edge.weight,
      })),
    [graph],
  )

  const contributorCount = graph?.nodes.length ?? 0
  const connectionCount = graph?.edges.length ?? 0
  const domainCount = useMemo(
    () =>
      new Set((graph?.nodes ?? []).flatMap((node: ExpertiseNode) => node.expertise.map((domain) => domain.domain))).size,
    [graph],
  )

  const sortedNodes = useMemo<ExpertiseNode[]>(
    () =>
      [...(graph?.nodes ?? [])].sort((left: ExpertiseNode, right: ExpertiseNode) => {
        const leftScore = left.expertise[0]?.score ?? 0
        const rightScore = right.expertise[0]?.score ?? 0
        if (rightScore !== leftScore) {
          return rightScore - leftScore
        }
        return left.github_login.localeCompare(right.github_login)
      }),
    [graph],
  )

  const effectiveSelectedNode = useMemo(
    () =>
      graph?.nodes.some((node) => node.id === selectedNode)
        ? selectedNode
        : null,
    [graph, selectedNode],
  )

  const selectedContributor = useMemo(
    () => graph?.nodes.find((node) => node.id === effectiveSelectedNode) ?? null,
    [graph, effectiveSelectedNode],
  )

  useEffect(() => {
    const svg = svgRef.current
    const container = containerRef.current

    if (!svg) {
      return
    }

    d3.select(svg).selectAll('*').remove()

    if (!container || nodes.length === 0) {
      return
    }

    const width = container.clientWidth
    const height = container.clientHeight

    d3.select(svg).attr('width', width).attr('height', height)

    const root = d3.select(svg).append('g').attr('class', 'root')

    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.45, 3.5])
      .on('zoom', (event) => {
        root.attr('transform', event.transform)
      })

    d3.select(svg).call(zoom)

    const simulation = d3
      .forceSimulation<SimNode>(nodes)
      .force(
        'link',
        d3
          .forceLink<SimNode, SimLink>(links)
          .id((node) => node.id)
          .distance((link) => 125 + (1 - link.weight) * 90),
      )
      .force('charge', d3.forceManyBody().strength(-330))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide<SimNode>().radius((node) => node.radius + 14))

    const link = root
      .append('g')
      .selectAll<SVGLineElement, SimLink>('line')
      .data(links)
      .join('line')
      .attr('stroke', '#c6d1b8')
      .attr('stroke-width', (edge) => 1 + edge.weight * 3.5)
      .attr('stroke-opacity', 0.7)
      .attr('stroke-linecap', 'round')

    const node = root
      .append('g')
      .selectAll<SVGGElement, SimNode>('g')
      .data(nodes)
      .join('g')
      .attr('class', 'node-group')
      .style('cursor', 'pointer')
      .call(
        d3
          .drag<SVGGElement, SimNode>()
          .on('start', (event, datum) => {
            if (!event.active) simulation.alphaTarget(0.3).restart()
            datum.fx = datum.x
            datum.fy = datum.y
          })
          .on('drag', (event, datum) => {
            datum.fx = event.x
            datum.fy = event.y
          })
          .on('end', (event, datum) => {
            if (!event.active) simulation.alphaTarget(0)
            datum.fx = null
            datum.fy = null
          }),
      )

    node
      .append('circle')
      .attr('r', (datum) => datum.radius)
      .attr('fill', (datum) => datum.color)
      .attr('stroke', '#ffffff')
      .attr('stroke-width', 3)

    node
      .append('text')
      .text((datum) => datum.github_login)
      .attr('text-anchor', 'middle')
      .attr('dy', (datum) => datum.radius + 15)
      .attr('fill', '#2d3526')
      .attr('font-size', '11px')
      .attr('font-weight', '700')

    node
      .append('text')
      .text((datum) => datum.top_domain)
      .attr('text-anchor', 'middle')
      .attr('dy', (datum) => datum.radius + 29)
      .attr('fill', '#757d6b')
      .attr('font-size', '10px')

    node
      .on('mousemove', (event, datum) => {
        setTooltip({ x: event.clientX, y: event.clientY, node: datum })
      })
      .on('mouseleave', () => {
        setTooltip(null)
      })
      .on('click', (_event, datum) => {
        setSelectedNode((current) => (current === datum.id ? null : datum.id))
      })

    simulation.on('tick', () => {
      link
        .attr('x1', (datum) => (datum.source as SimNode).x ?? 0)
        .attr('y1', (datum) => (datum.source as SimNode).y ?? 0)
        .attr('x2', (datum) => (datum.target as SimNode).x ?? 0)
        .attr('y2', (datum) => (datum.target as SimNode).y ?? 0)

      node.attr('transform', (datum) => `translate(${datum.x ?? 0},${datum.y ?? 0})`)
    })

    const updateHighlight = (selectedId: string | null) => {
      if (!selectedId) {
        node.style('opacity', 1)
        node
          .selectAll<SVGCircleElement, SimNode>('circle')
          .attr('stroke', '#ffffff')
          .attr('stroke-width', 3)
        link.attr('stroke-opacity', 0.7).attr('stroke', '#c6d1b8')
        return
      }

      const connectedIds = new Set<string>([selectedId])
      links.forEach((edge) => {
        const sourceId = typeof edge.source === 'object' ? (edge.source as SimNode).id : String(edge.source)
        const targetId = typeof edge.target === 'object' ? (edge.target as SimNode).id : String(edge.target)

        if (sourceId === selectedId) connectedIds.add(targetId)
        if (targetId === selectedId) connectedIds.add(sourceId)
      })

      node.style('opacity', (datum) => (connectedIds.has(datum.id) ? 1 : 0.22))
      node
        .selectAll<SVGCircleElement, SimNode>('circle')
        .attr('stroke', (datum) => (datum.id === selectedId ? '#2d3526' : '#ffffff'))
        .attr('stroke-width', (datum) => (datum.id === selectedId ? 4 : 3))

      link
        .attr('stroke-opacity', (datum) => {
          const sourceId = (datum.source as SimNode).id
          const targetId = (datum.target as SimNode).id
          return sourceId === selectedId || targetId === selectedId ? 0.95 : 0.12
        })
        .attr('stroke', (datum) => {
          const sourceId = (datum.source as SimNode).id
          const targetId = (datum.target as SimNode).id
          return sourceId === selectedId || targetId === selectedId ? '#5f5e5e' : '#d6dec8'
        })
    }

    ;(svg as SVGSVGElement & { _setHighlight?: (id: string | null) => void })._setHighlight =
      updateHighlight

    return () => {
      simulation.stop()
    }
  }, [nodes, links])

  useEffect(() => {
    const svg = svgRef.current as (SVGSVGElement & {
      _setHighlight?: (id: string | null) => void
    }) | null

    svg?._setHighlight?.(effectiveSelectedNode)
  }, [effectiveSelectedNode])

  const hasData = contributorCount > 0
  const status = syncStatus?.status ?? 'never'
  const statusMeta = syncStatusMeta(status)

  return (
    <div className="flex min-h-screen flex-col bg-[#f9faf0]">
      <header className="sticky top-0 z-30 bg-[#f9faf0]/80 px-8 py-4 shadow-[0px_1px_0px_rgba(184,196,168,0.3)] backdrop-blur-[20px]">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <div className="mb-1 flex items-center gap-3">
              <h1
                className="text-2xl font-bold tracking-tight text-[#2d3526]"
                style={{ fontFamily: 'var(--font-manrope)', letterSpacing: '-0.02em' }}
              >
                Expertise Map
              </h1>
              <span
                className="inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide"
                style={{ backgroundColor: statusMeta.bg, color: statusMeta.color }}
              >
                <Circle
                  className={`h-1.5 w-1.5 ${status === 'running' ? 'animate-pulse' : ''}`}
                  fill={statusMeta.color}
                  stroke="none"
                />
                {statusMeta.label}
              </span>
            </div>
            <p className="text-sm text-[#757d6b]">
              Explore who owns what, where knowledge overlaps, and who is strongest in each domain.
            </p>
          </div>

          <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
            <div className="text-sm text-[#757d6b]">
              Last synced:{' '}
              <span className="font-medium text-[#2d3526]">{formatDate(syncStatus?.synced_at ?? null)}</span>
            </div>
            <button
              onClick={handleSync}
              disabled={syncing}
              className="inline-flex items-center gap-2 rounded-2xl px-5 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              style={{
                fontFamily: 'var(--font-manrope)',
                background: 'linear-gradient(180deg, #5f5e5e 0%, #535252 100%)',
              }}
            >
              <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Syncing GitHub…' : 'Sync from GitHub'}
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 space-y-8 bg-[#f9faf0] p-8">
        <section className="grid grid-cols-1 gap-5 md:grid-cols-3">
          <StatCard
            label="Contributors Mapped"
            value={String(contributorCount)}
            caption="People currently represented in the expertise graph."
            pipColor="#5f5e5e"
          />
          <StatCard
            label="Shared Connections"
            value={String(connectionCount)}
            caption="Contributor pairs with meaningful overlapping domain strength."
            pipColor="#3a6b4a"
          />
          <StatCard
            label="Distinct Domains"
            value={String(domainCount)}
            caption="Unique services and technical areas found across contributors."
            pipColor="#a07842"
          />
        </section>

        <section className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.5fr)_24rem]">
          <div className="rounded-3xl bg-white p-6 shadow-[0px_2px_32px_rgba(45,53,38,0.06)]">
            <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="mb-2 flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-[#5f5e5e]" />
                  <p
                    className="text-[10px] font-semibold uppercase tracking-widest text-[#757d6b]"
                    style={{ fontFamily: 'var(--font-manrope)' }}
                  >
                    Network View
                  </p>
                </div>
                <h2
                  className="text-xl font-bold text-[#2d3526]"
                  style={{ fontFamily: 'var(--font-manrope)' }}
                >
                  Team Expertise Graph
                </h2>
                <p className="mt-1 max-w-2xl text-sm text-[#757d6b]">
                  Node size reflects breadth of expertise. Click a contributor to focus their neighborhood, then
                  inspect the right rail for details.
                </p>
              </div>

              <div className="flex flex-wrap gap-2 text-[11px] font-medium text-[#757d6b]">
                <span className="rounded-full bg-[#f2f5e8] px-3 py-1">Drag nodes to reposition</span>
                <span className="rounded-full bg-[#f2f5e8] px-3 py-1">Scroll to zoom</span>
                <span className="rounded-full bg-[#f2f5e8] px-3 py-1">Click to isolate</span>
              </div>
            </div>

            <div
              ref={containerRef}
              className="relative h-[560px] overflow-hidden rounded-[28px] border border-[#b8c4a8]/20 bg-[#f9faf0]"
            >
              {!hasData && !graphError && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-center">
                  <GitBranch className="h-12 w-12 text-[#b8c4a8]" />
                  <div>
                    <p
                      className="text-lg font-bold text-[#2d3526]"
                      style={{ fontFamily: 'var(--font-manrope)' }}
                    >
                      No expertise data yet
                    </p>
                    <p className="mt-1 text-sm text-[#757d6b]">
                      Trigger a GitHub sync to build the first contributor graph.
                    </p>
                  </div>
                </div>
              )}

              {graphError && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-center">
                  <GitBranch className="h-12 w-12 text-[#9f403d]" />
                  <div>
                    <p
                      className="text-lg font-bold text-[#2d3526]"
                      style={{ fontFamily: 'var(--font-manrope)' }}
                    >
                      Failed to load expertise data
                    </p>
                    <p className="mt-1 text-sm text-[#757d6b]">{graphError.message}</p>
                  </div>
                  <button
                    onClick={() => refreshGraph()}
                    className="rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-[#5f5e5e] shadow-[0px_1px_8px_rgba(45,53,38,0.06)] transition-opacity hover:opacity-90"
                    style={{ fontFamily: 'var(--font-manrope)' }}
                  >
                    Retry
                  </button>
                </div>
              )}

              <svg ref={svgRef} className="h-full w-full" />
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-3xl bg-white p-6 shadow-[0px_2px_32px_rgba(45,53,38,0.04)]">
              <div className="mb-4 flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-[#3a6b4a]" />
                <p
                  className="text-[10px] font-semibold uppercase tracking-widest text-[#757d6b]"
                  style={{ fontFamily: 'var(--font-manrope)' }}
                >
                  Focus Panel
                </p>
              </div>

              {selectedContributor ? (
                <>
                  <div className="mb-5 flex items-center gap-3">
                    {selectedContributor.avatar_url ? (
                      <img
                        src={selectedContributor.avatar_url}
                        alt={selectedContributor.name}
                        className="h-12 w-12 rounded-2xl object-cover"
                      />
                    ) : (
                      <div
                        className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#f2f5e8] text-sm font-semibold text-[#2d3526]"
                        style={{ fontFamily: 'var(--font-manrope)' }}
                      >
                        {contributorInitials(selectedContributor.name)}
                      </div>
                    )}
                    <div className="min-w-0">
                      <h3
                        className="truncate text-lg font-bold text-[#2d3526]"
                        style={{ fontFamily: 'var(--font-manrope)' }}
                      >
                        {selectedContributor.github_login}
                      </h3>
                      <p className="text-sm text-[#757d6b]">
                        {selectedContributor.expertise.length} mapped domain
                        {selectedContributor.expertise.length === 1 ? '' : 's'}
                      </p>
                    </div>
                  </div>

                  <div className="mb-5 rounded-3xl bg-[#f9faf0] p-4">
                    <p
                      className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-[#757d6b]"
                      style={{ fontFamily: 'var(--font-manrope)' }}
                    >
                      Strongest Domain
                    </p>
                    <p
                      className="text-2xl font-bold text-[#2d3526]"
                      style={{ fontFamily: 'var(--font-manrope)', letterSpacing: '-0.01em' }}
                    >
                      {selectedContributor.top_domain}
                    </p>
                  </div>

                  <div className="space-y-3">
                    {selectedContributor.expertise.map((domain) => (
                      <div key={domain.domain}>
                        <div className="mb-1.5 flex items-center justify-between gap-3">
                          <span className="truncate text-sm font-medium text-[#2d3526]">
                            {domain.domain}
                          </span>
                          <span className="shrink-0 text-xs text-[#757d6b]">
                            {Math.round(domain.score * 100)}%
                          </span>
                        </div>
                        <div className="h-2.5 overflow-hidden rounded-full bg-[#eef1e7]">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${Math.max(Math.round(domain.score * 100), 8)}%`,
                              backgroundColor: domainScoreColor(domain.score),
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="rounded-3xl bg-[#f9faf0] p-6 text-center">
                  <GitBranch className="mx-auto mb-3 h-8 w-8 text-[#b8c4a8]" />
                  <p
                    className="text-base font-bold text-[#2d3526]"
                    style={{ fontFamily: 'var(--font-manrope)' }}
                  >
                    Select a contributor
                  </p>
                  <p className="mt-1 text-sm text-[#757d6b]">
                    Click any node in the graph or any card below to inspect their domain profile.
                  </p>
                </div>
              )}
            </div>

            <div className="rounded-3xl bg-white p-4 shadow-[0px_2px_32px_rgba(45,53,38,0.04)]">
              <div className="mb-4 flex items-center justify-between gap-3 px-2">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-[#757d6b]" />
                  <h3
                    className="text-base font-bold text-[#2d3526]"
                    style={{ fontFamily: 'var(--font-manrope)' }}
                  >
                    Contributors
                  </h3>
                </div>
                <span className="text-xs font-medium text-[#757d6b]">
                  {sortedNodes.length} total
                </span>
              </div>

              <div className="max-h-[540px] space-y-2 overflow-y-auto pr-1">
                {hasData ? (
                  sortedNodes.map((node) => (
                    <ContributorCard
                      key={node.id}
                      node={node}
                      isSelected={effectiveSelectedNode === node.id}
                      onClick={() =>
                        setSelectedNode((current) => (current === node.id ? null : node.id))
                      }
                    />
                  ))
                ) : (
                  <div className="rounded-3xl bg-[#f9faf0] p-6 text-center text-sm text-[#757d6b]">
                    Contributor cards will appear here after the first sync completes.
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-3xl bg-white p-6 shadow-[0px_2px_32px_rgba(45,53,38,0.04)]">
              <div className="mb-3 flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-[#a07842]" />
                <p
                  className="text-[10px] font-semibold uppercase tracking-widest text-[#757d6b]"
                  style={{ fontFamily: 'var(--font-manrope)' }}
                >
                  Sync Status
                </p>
              </div>

              <div
                className="mb-3 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold"
                style={{ backgroundColor: statusMeta.bg, color: statusMeta.color }}
              >
                <Circle
                  className={`h-2 w-2 ${status === 'running' ? 'animate-pulse' : ''}`}
                  fill={statusMeta.color}
                  stroke="none"
                />
                {statusMeta.label}
              </div>

              <p className="text-sm text-[#757d6b]">
                Last synced <span className="font-medium text-[#2d3526]">{formatDate(syncStatus?.synced_at ?? null)}</span>
              </p>

              {syncStatus?.status === 'success' && (
                <p className="mt-2 text-sm text-[#757d6b]">
                  {syncStatus.contributors_analyzed} contributors analyzed across{' '}
                  {syncStatus.domains_extracted} extracted domains.
                </p>
              )}

              {syncStatus?.error_message && (
                <p className="mt-3 rounded-2xl bg-[#f5e7e5] px-4 py-3 text-sm text-[#9f403d]">
                  {syncStatus.error_message}
                </p>
              )}

              {syncError && (
                <p className="mt-3 rounded-2xl bg-[#f5e7e5] px-4 py-3 text-sm text-[#9f403d]">
                  {syncError.message}
                </p>
              )}
            </div>
          </div>
        </section>
      </main>

      {tooltip && <Tooltip tip={tooltip} />}
    </div>
  )
}
