import { useRef, useEffect, useCallback, useState } from 'react'
import ForceGraph2D from 'react-force-graph-2d'
import { X } from 'lucide-react'
import { useGraphStore, type GraphNode } from '../store/graph'
import { useIdentityStore } from '../store/identity'
import { timeAgo } from '../lib/timeago'

interface Props {
  onClose: () => void
}

interface NodeObj extends GraphNode {
  x?: number
  y?: number
}

export function MeshGraph({ onClose }: Props) {
  const nodes = useGraphStore((s) => s.nodes)
  const edges = useGraphStore((s) => s.edges)
  const purgeStale = useGraphStore((s) => s.purgeStale)
  const myPubkey = useIdentityStore((s) => s.pubkey)
  const containerRef = useRef<HTMLDivElement>(null)
  const [dimensions, setDimensions] = useState({ w: 400, h: 400 })
  const [tooltip, setTooltip] = useState<{ alias: string; time: number } | null>(null)

  // Purge stale nodes periodically
  useEffect(() => {
    const id = setInterval(() => purgeStale(), 30_000)
    return () => clearInterval(id)
  }, [purgeStale])

  // Track container size
  useEffect(() => {
    if (!containerRef.current) return
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect
      setDimensions({ w: width, h: height })
    })
    ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [])

  // Build graph data
  const graphData = {
    nodes: nodes.map((n) => ({ ...n })),
    links: edges.map((e) => ({
      source: e.source,
      target: e.target,
      lastPulsed: e.lastPulsed,
      messageCount: e.messageIds.length,
    })),
  }

  const nodeColor = useCallback(
    (node: NodeObj) => {
      const age = Date.now() - node.lastActive
      const maxAge = 300_000
      const t = Math.min(age / maxAge, 1)
      if (node.id === myPubkey) return '#0B3D91'
      // Interpolate from slate-900 to slate-300
      const r = Math.round(15 + t * (188 - 15))
      const g = Math.round(23 + t * (194 - 23))
      const b = Math.round(42 + t * (204 - 42))
      return `rgb(${r},${g},${b})`
    },
    [myPubkey],
  )

  const nodeCanvasObject = useCallback(
    (node: NodeObj, ctx: CanvasRenderingContext2D) => {
      const x = node.x ?? 0
      const y = node.y ?? 0
      const age = Date.now() - node.lastActive
      const maxAge = 300_000
      const activity = 1 - Math.min(age / maxAge, 1)
      const radius = 5 + activity * 5
      const isSelf = node.id === myPubkey

      // Self ring
      if (isSelf) {
        ctx.beginPath()
        ctx.arc(x, y, radius + 3, 0, 2 * Math.PI)
        ctx.strokeStyle = '#0B3D91'
        ctx.lineWidth = 2
        ctx.stroke()
      }

      // Node circle
      ctx.beginPath()
      ctx.arc(x, y, radius, 0, 2 * Math.PI)
      ctx.fillStyle = nodeColor(node)
      ctx.fill()

      // Label
      ctx.fillStyle = '#475569'
      ctx.font = '10px system-ui, sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(node.alias, x, y + radius + 12)
    },
    [myPubkey, nodeColor],
  )

  const linkWidth = useCallback((link: { lastPulsed: number }) => {
    const age = Date.now() - link.lastPulsed
    if (age < 1500) return 3 + 2 * (1 - age / 1500) // pulse for 1.5s
    return 1
  }, [])

  const linkColor = useCallback((link: { lastPulsed: number }) => {
    const age = Date.now() - link.lastPulsed
    if (age < 1500) return '#0B3D91'
    return '#cbd5e1' // slate-300
  }, [])

  const handleNodeClick = useCallback((node: NodeObj) => {
    setTooltip({ alias: node.alias, time: node.lastActive })
    setTimeout(() => setTooltip(null), 3000)
  }, [])

  const isEmpty = nodes.length === 0

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-100 shrink-0">
        <h3 className="text-sm font-semibold text-slate-900">Mesh network</h3>
        <button
          onClick={onClose}
          className="p-1 text-slate-400 hover:text-slate-600 transition-colors duration-150"
        >
          <X size={20} />
        </button>
      </div>

      {/* Graph */}
      <div ref={containerRef} className="flex-1 relative">
        {isEmpty ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <p className="text-sm text-slate-400">No peers connected yet.</p>
              <p className="text-xs text-slate-400 mt-1">Sync with another device to see the mesh.</p>
            </div>
          </div>
        ) : (
          <ForceGraph2D
            width={dimensions.w}
            height={dimensions.h}
            graphData={graphData}
            nodeCanvasObject={nodeCanvasObject as any}
            nodePointerAreaPaint={(node: any, color: string, ctx: CanvasRenderingContext2D) => {
              ctx.beginPath()
              ctx.arc(node.x ?? 0, node.y ?? 0, 12, 0, 2 * Math.PI)
              ctx.fillStyle = color
              ctx.fill()
            }}
            linkWidth={linkWidth as any}
            linkColor={linkColor as any}
            onNodeClick={handleNodeClick as any}
            cooldownTicks={100}
            enableZoomInteraction={true}
            enablePanInteraction={true}
          />
        )}

        {/* Tooltip */}
        {tooltip && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-xs px-3 py-1.5 rounded-lg shadow-lg animate-fade-in">
            {tooltip.alias} — active {timeAgo(tooltip.time)}
          </div>
        )}

        {/* Legend */}
        <div className="absolute bottom-4 left-4 bg-white/90 rounded-lg border border-slate-200 px-3 py-2 text-[10px] text-slate-500 space-y-1">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-[#0B3D91]" /> You
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-slate-700" /> Active peer
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-slate-300" /> Inactive
          </div>
          <div className="flex items-center gap-2">
            <span className="w-6 h-0.5 bg-[#0B3D91]" /> Recent hop
          </div>
        </div>
      </div>
    </div>
  )
}
