'use client'

import { useCallback, useEffect, useRef, useState, useMemo } from 'react'
import * as d3 from 'd3'
import { GitBranch, RefreshCw, Circle } from 'lucide-react'
import { useExpertiseGraph, useExpertiseSyncStatus } from '@/lib/hooks'
import { triggerExpertiseSync } from '@/lib/api'
import type { ExpertiseNode, ExpertiseEdge, ExpertiseDomain } from '@/lib/types'

// ---------------------------------------------------------------------------
// D3 simulation node/link types
// ---------------------------------------------------------------------------

interface SimNode extends d3.SimulationNodeDatum, ExpertiseNode {
  radius: number
  color: string
}

interface SimLink extends d3.SimulationLinkDatum<SimNode> {
  shared_domains: string[]
  weight: number
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const COLOR_SCALE = d3.scaleOrdinal(d3.schemeTableau10)

function domainScoreColor(score: number): string {
  if (score >= 0.8) return '#4ade80'   // green
  if (score >= 0.5) return '#facc15'   // yellow
  return '#94a3b8'                      // slate
}

function formatDate(iso: string | null): string {
  if (!iso) return 'Never'
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// ---------------------------------------------------------------------------
// Tooltip component
// ---------------------------------------------------------------------------

interface TooltipState {
  x: number
  y: number
  node: ExpertiseNode
}

function Tooltip({ tip }: { tip: TooltipState }) {
  return (
    <div
      className="pointer-events-none fixed z-50 border-2 border-black bg-slate-800 p-3 shadow-[4px_4px_0_0_rgba(0,0,0,1)] text-sm max-w-xs"
      style={{ left: tip.x + 14, top: tip.y - 10 }}
    >
      <p className="font-black text-white mb-2">{tip.node.github_login}</p>
      <p className="text-xs text-slate-400 mb-2">Top: {tip.node.top_domain}</p>
      <div className="flex flex-col gap-1">
        {tip.node.expertise.map((d) => (
          <div key={d.domain} className="flex items-center gap-2">
            <div
              className="h-2 rounded-sm"
              style={{
                width: `${Math.round(d.score * 64)}px`,
                backgroundColor: domainScoreColor(d.score),
              }}
            />
            <span className="text-slate-300 text-xs">{d.domain}</span>
            <span className="text-slate-500 text-xs ml-auto">{Math.round(d.score * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sidebar contributor card
// ---------------------------------------------------------------------------

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
      className={`w-full text-left border-2 p-3 transition-all ${
        isSelected
          ? 'border-violet-400 bg-violet-900/30'
          : 'border-slate-700 bg-slate-800/50 hover:border-slate-500'
      }`}
    >
      <div className="flex items-center gap-3 mb-2">
        {node.avatar_url ? (
          <img
            src={node.avatar_url}
            alt={node.name}
            className="w-8 h-8 rounded-full border-2 border-black"
          />
        ) : (
          <div className="w-8 h-8 bg-violet-500 border-2 border-black flex items-center justify-center text-xs font-black text-black">
            {node.name.slice(0, 2).toUpperCase()}
          </div>
        )}
        <div>
          <p className="text-sm font-bold text-white">{node.github_login}</p>
          <p className="text-xs text-slate-400">{node.top_domain}</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-1">
        {node.expertise.slice(0, 4).map((d) => (
          <span
            key={d.domain}
            className="text-xs px-2 py-0.5 border border-current font-medium"
            style={{ color: domainScoreColor(d.score) }}
          >
            {d.domain}
          </span>
        ))}
        {node.expertise.length > 4 && (
          <span className="text-xs text-slate-500">+{node.expertise.length - 4}</span>
        )}
      </div>
    </button>
  )
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function ExpertisePage() {
  const { data: graph, mutate: refreshGraph } = useExpertiseGraph()
  const [syncing, setSyncing] = useState(false)
  const [selectedNode, setSelectedNode] = useState<string | null>(null)
  const [tooltip, setTooltip] = useState<TooltipState | null>(null)

  // Poll sync status while syncing
  const { data: syncStatus, mutate: refreshStatus } = useExpertiseSyncStatus(syncing)

  // Stop polling once sync is no longer running
  useEffect(() => {
    if (syncStatus && syncStatus.status !== 'running' && syncing) {
      setSyncing(false)
      refreshGraph()
    }
  }, [syncStatus, syncing, refreshGraph])

  const handleSync = useCallback(async () => {
    setSyncing(true)
    try {
      await triggerExpertiseSync()
      refreshStatus()
    } catch (err) {
      console.error('Sync failed to trigger:', err)
      setSyncing(false)
    }
  }, [refreshStatus])

  // ---------------------------------------------------------------------------
  // D3 graph
  // ---------------------------------------------------------------------------

  const svgRef = useRef<SVGSVGElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const nodes = useMemo<SimNode[]>(
    () =>
      (graph?.nodes ?? []).map((n, i) => ({
        ...n,
        radius: 18 + n.expertise.length * 3,
        color: COLOR_SCALE(String(i)),
      })),
    [graph],
  )

  const links = useMemo<SimLink[]>(
    () =>
      (graph?.edges ?? []).map((e) => ({
        source: e.source,
        target: e.target,
        shared_domains: e.shared_domains,
        weight: e.weight,
      })),
    [graph],
  )

  useEffect(() => {
    const svg = svgRef.current
    const container = containerRef.current
    if (!svg || !container || nodes.length === 0) return

    const width = container.clientWidth
    const height = container.clientHeight

    // Clear previous render
    d3.select(svg).selectAll('*').remove()

    d3.select(svg)
      .attr('width', width)
      .attr('height', height)

    // Root group (zoom/pan target)
    const root = d3.select(svg).append('g').attr('class', 'root')

    // Zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.2, 4])
      .on('zoom', (event) => {
        root.attr('transform', event.transform)
      })
    d3.select(svg).call(zoom)

    // Arrow marker for edges
    d3.select(svg)
      .append('defs')
      .append('marker')
      .attr('id', 'arrowhead')
      .attr('viewBox', '-0 -5 10 10')
      .attr('refX', 13)
      .attr('refY', 0)
      .attr('orient', 'auto')
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .append('path')
      .attr('d', 'M 0,-5 L 10 ,0 L 0,5')
      .attr('fill', '#475569')

    // Simulation
    const simulation = d3
      .forceSimulation<SimNode>(nodes)
      .force(
        'link',
        d3
          .forceLink<SimNode, SimLink>(links)
          .id((d) => d.id)
          .distance((d) => 120 + (1 - d.weight) * 80),
      )
      .force('charge', d3.forceManyBody().strength(-300))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide<SimNode>().radius((d) => d.radius + 12))

    // Links
    const link = root
      .append('g')
      .selectAll<SVGPathElement, SimLink>('path')
      .data(links)
      .join('path')
      .attr('fill', 'none')
      .attr('stroke', '#334155')
      .attr('stroke-width', (d) => 1 + d.weight * 4)
      .attr('stroke-opacity', 0.6)

    // Node groups
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
          .on('start', (event, d) => {
            if (!event.active) simulation.alphaTarget(0.3).restart()
            d.fx = d.x
            d.fy = d.y
          })
          .on('drag', (event, d) => {
            d.fx = event.x
            d.fy = event.y
          })
          .on('end', (event, d) => {
            if (!event.active) simulation.alphaTarget(0)
            d.fx = null
            d.fy = null
          }),
      )

    // Node circle
    node
      .append('circle')
      .attr('r', (d) => d.radius)
      .attr('fill', (d) => d.color)
      .attr('stroke', '#000')
      .attr('stroke-width', 2)

    // Node label (name)
    node
      .append('text')
      .text((d) => d.github_login)
      .attr('text-anchor', 'middle')
      .attr('dy', (d) => d.radius + 14)
      .attr('fill', '#e2e8f0')
      .attr('font-size', '11px')
      .attr('font-weight', 'bold')
      .attr('font-family', 'Space Grotesk, sans-serif')

    // Node sublabel (top domain)
    node
      .append('text')
      .text((d) => d.top_domain)
      .attr('text-anchor', 'middle')
      .attr('dy', (d) => d.radius + 27)
      .attr('fill', '#64748b')
      .attr('font-size', '9px')
      .attr('font-family', 'Space Grotesk, sans-serif')

    // Hover tooltip
    node
      .on('mousemove', (event, d) => {
        setTooltip({ x: event.clientX, y: event.clientY, node: d })
      })
      .on('mouseleave', () => setTooltip(null))
      .on('click', (_event, d) => {
        setSelectedNode((prev) => (prev === d.id ? null : d.id))
      })

    // Tick
    simulation.on('tick', () => {
      link.attr('d', (d) => {
        const src = d.source as SimNode
        const tgt = d.target as SimNode
        const dx = (tgt.x ?? 0) - (src.x ?? 0)
        const dy = (tgt.y ?? 0) - (src.y ?? 0)
        const dr = Math.sqrt(dx * dx + dy * dy) * 1.5
        return `M${src.x},${src.y}A${dr},${dr} 0 0,1 ${tgt.x},${tgt.y}`
      })

      node.attr('transform', (d) => `translate(${d.x ?? 0},${d.y ?? 0})`)
    })

    // Highlight selected node + its edges
    const updateHighlight = (selectedId: string | null) => {
      if (!selectedId) {
        node.style('opacity', 1)
        link.attr('stroke-opacity', 0.6)
        return
      }
      const connectedIds = new Set<string>([selectedId])
      links.forEach((l) => {
        const s = (l.source as SimNode).id
        const t = (l.target as SimNode).id
        if (s === selectedId) connectedIds.add(t)
        if (t === selectedId) connectedIds.add(s)
      })
      node.style('opacity', (d) => (connectedIds.has(d.id) ? 1 : 0.2))
      link.attr('stroke-opacity', (d) => {
        const s = (d.source as SimNode).id
        const t = (d.target as SimNode).id
        return s === selectedId || t === selectedId ? 0.9 : 0.1
      })
    }

    // Re-apply highlight when selectedNode state changes
    // We use a MutationObserver-free approach: store callback on the svg element
    ;(svg as unknown as { _setHighlight: (id: string | null) => void })._setHighlight =
      updateHighlight

    return () => {
      simulation.stop()
    }
  }, [nodes, links])

  // Apply highlight whenever selectedNode changes
  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    const fn = (svg as unknown as { _setHighlight?: (id: string | null) => void })._setHighlight
    if (fn) fn(selectedNode)
  }, [selectedNode])

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const hasData = (graph?.nodes?.length ?? 0) > 0

  return (
    <div className="flex h-screen bg-[#060e20] text-[#dee5ff]" style={{ fontFamily: 'var(--font-space-grotesk)' }}>
      {/* Graph area */}
      <div ref={containerRef} className="flex-1 relative overflow-hidden">
        {!hasData && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-slate-500">
            <GitBranch className="w-16 h-16 opacity-30" />
            <p className="text-lg font-bold">No expertise data yet</p>
            <p className="text-sm">Click &ldquo;Sync from GitHub&rdquo; in the sidebar to analyze the repo.</p>
          </div>
        )}
        <svg ref={svgRef} className="w-full h-full" />
        {tooltip && <Tooltip tip={tooltip} />}
      </div>

      {/* Sidebar */}
      <aside className="w-80 shrink-0 border-l-4 border-black bg-slate-900 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b-2 border-white/10 shrink-0">
          <div className="flex items-center gap-2 mb-1">
            <GitBranch className="w-5 h-5 text-violet-400" />
            <h2 className="text-lg font-black text-white">Expertise Map</h2>
          </div>
          <p className="text-xs text-slate-400">
            {hasData
              ? `${graph!.nodes.length} contributors · ${graph!.edges.length} connections`
              : 'No data — sync from GitHub to populate'}
          </p>
        </div>

        {/* Sync controls */}
        <div className="p-4 border-b-2 border-white/10 shrink-0">
          <button
            onClick={handleSync}
            disabled={syncing}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 border-2 border-black bg-violet-600 text-black font-bold hover:bg-violet-500 disabled:opacity-60 disabled:cursor-not-allowed shadow-[2px_2px_0_0_rgba(0,0,0,1)] transition-all hover:translate-x-0.5 hover:-translate-y-0.5"
          >
            <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Syncing…' : 'Sync from GitHub'}
          </button>

          {syncStatus && syncStatus.status !== 'never' && (
            <div className="mt-2 text-xs text-slate-500 space-y-0.5">
              <div className="flex items-center gap-1">
                <Circle
                  className="w-2 h-2 shrink-0"
                  fill={
                    syncStatus.status === 'success'
                      ? '#4ade80'
                      : syncStatus.status === 'running'
                      ? '#facc15'
                      : '#f87171'
                  }
                  stroke="none"
                />
                <span className="capitalize">{syncStatus.status}</span>
                {syncStatus.status === 'success' && (
                  <span>
                    · {syncStatus.contributors_analyzed} contributors · {syncStatus.domains_extracted} domains
                  </span>
                )}
              </div>
              <p>Last synced: {formatDate(syncStatus.synced_at)}</p>
              {syncStatus.error_message && (
                <p className="text-red-400 truncate" title={syncStatus.error_message}>
                  {syncStatus.error_message}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Contributor list */}
        <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
          {hasData ? (
            graph!.nodes.map((node) => (
              <ContributorCard
                key={node.id}
                node={node}
                isSelected={selectedNode === node.id}
                onClick={() => setSelectedNode((prev) => (prev === node.id ? null : node.id))}
              />
            ))
          ) : (
            <p className="text-xs text-slate-600 text-center mt-8">
              Contributor cards will appear here after syncing.
            </p>
          )}
        </div>
      </aside>
    </div>
  )
}
