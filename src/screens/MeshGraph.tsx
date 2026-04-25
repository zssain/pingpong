import { useRef, useEffect, useCallback, useState } from 'react'
import ForceGraph2D from 'react-force-graph-2d'
import { X } from 'lucide-react'
import { useGraphStore, type GraphNode } from '../store/graph'
import { useIdentityStore } from '../store/identity'
import { timeAgo } from '../lib/timeago'

interface Props { onClose: () => void }
interface NodeObj extends GraphNode { x?: number; y?: number }

export function MeshGraph({ onClose }: Props) {
  const nodes = useGraphStore((s) => s.nodes)
  const edges = useGraphStore((s) => s.edges)
  const purgeStale = useGraphStore((s) => s.purgeStale)
  const myPubkey = useIdentityStore((s) => s.pubkey)
  const containerRef = useRef<HTMLDivElement>(null)
  const [dimensions, setDimensions] = useState({ w: 400, h: 400 })
  const [tooltip, setTooltip] = useState<{ alias: string; time: number } | null>(null)

  useEffect(() => {
    const id = setInterval(() => purgeStale(), 30_000)
    return () => clearInterval(id)
  }, [purgeStale])

  useEffect(() => {
    if (!containerRef.current) return
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect
      setDimensions({ w: width, h: height })
    })
    ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [])

  const graphData = {
    nodes: nodes.map((n) => ({ ...n })),
    links: edges.map((e) => ({ source: e.source, target: e.target, lastPulsed: e.lastPulsed, messageCount: e.messageIds.length })),
  }

  const nodeColor = useCallback((node: NodeObj) => {
    if (node.id === myPubkey) return '#D4A574'
    const age = Date.now() - node.lastActive
    return age < 300_000 ? '#86898E' : '#3A3E44'
  }, [myPubkey])

  const nodeCanvasObject = useCallback((node: NodeObj, ctx: CanvasRenderingContext2D) => {
    const x = node.x ?? 0, y = node.y ?? 0
    const age = Date.now() - node.lastActive
    const activity = 1 - Math.min(age / 300_000, 1)
    const radius = 4 + activity * 4
    const isSelf = node.id === myPubkey

    if (isSelf) {
      ctx.beginPath(); ctx.arc(x, y, radius + 3, 0, 2 * Math.PI)
      ctx.strokeStyle = '#D4A574'; ctx.lineWidth = 1.5; ctx.stroke()
    }
    ctx.beginPath(); ctx.arc(x, y, radius, 0, 2 * Math.PI)
    ctx.fillStyle = nodeColor(node); ctx.fill()

    ctx.fillStyle = '#86898E'; ctx.font = '10px "DM Mono", monospace'
    ctx.textAlign = 'center'; ctx.fillText(node.alias, x, y + radius + 12)
  }, [myPubkey, nodeColor])

  const linkWidth = useCallback((link: { lastPulsed: number }) => {
    const age = Date.now() - link.lastPulsed
    return age < 1500 ? 2 + 1.5 * (1 - age / 1500) : 0.5
  }, [])

  const linkColor = useCallback((link: { lastPulsed: number }) => {
    const age = Date.now() - link.lastPulsed
    return age < 1500 ? 'rgba(212, 165, 116, 0.6)' : '#2A2D31'
  }, [])

  const handleNodeClick = useCallback((node: NodeObj) => {
    setTooltip({ alias: node.alias, time: node.lastActive })
    setTimeout(() => setTooltip(null), 3000)
  }, [])

  const isEmpty = nodes.length === 0

  return (
    <div className="fixed inset-0 z-[60] bg-bg flex flex-col animate-fade-in">
      <div className="flex items-center justify-between p-4 border-b border-border shrink-0">
        <h3 className="text-[10px] font-mono uppercase tracking-[0.2em] text-text-muted">WISP NETWORK</h3>
        <button onClick={onClose} className="p-1 text-text-muted hover:text-text transition-colors duration-150">
          <X size={18} />
        </button>
      </div>

      <div ref={containerRef} className="flex-1 relative bg-bg">
        {isEmpty ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center space-y-2">
              <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-text-dim">NO PEERS CONNECTED</p>
              <p className="text-xs font-mono text-text-muted">Sync with another device to see the network.</p>
            </div>
          </div>
        ) : (
          <ForceGraph2D
            width={dimensions.w} height={dimensions.h}
            graphData={graphData}
            backgroundColor="#0E0F11"
            nodeCanvasObject={nodeCanvasObject as any}
            nodePointerAreaPaint={(node: any, color: string, ctx: CanvasRenderingContext2D) => {
              ctx.beginPath(); ctx.arc(node.x ?? 0, node.y ?? 0, 12, 0, 2 * Math.PI)
              ctx.fillStyle = color; ctx.fill()
            }}
            linkWidth={linkWidth as any} linkColor={linkColor as any}
            onNodeClick={handleNodeClick as any}
            cooldownTicks={100} enableZoomInteraction={true} enablePanInteraction={true}
          />
        )}

        {tooltip && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-surface border border-border text-text text-[10px] font-mono px-3 py-1.5 animate-fade-in">
            {tooltip.alias} — active {timeAgo(tooltip.time)}
          </div>
        )}

        <div className="absolute bottom-4 left-4 space-y-1 text-[10px] font-mono uppercase tracking-wider text-text-muted border border-border bg-surface/80 backdrop-blur-sm p-3">
          <div className="flex items-center gap-2"><span className="w-2 h-2 bg-accent" /> YOU</div>
          <div className="flex items-center gap-2"><span className="w-2 h-2 bg-text-muted" /> ACTIVE</div>
          <div className="flex items-center gap-2"><span className="w-2 h-2 bg-border-mid" /> INACTIVE</div>
          <div className="flex items-center gap-2"><span className="w-5 h-px bg-accent" /> RECENT HOP</div>
        </div>
      </div>
    </div>
  )
}
