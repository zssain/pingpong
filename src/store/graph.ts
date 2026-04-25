import { create } from 'zustand'

export interface GraphNode {
  id: string
  alias: string
  lastActive: number
}

export interface GraphEdge {
  source: string
  target: string
  lastPulsed: number
  messageIds: string[]
}

interface GraphState {
  nodes: GraphNode[]
  edges: GraphEdge[]
  recordHop: (fromPub: string, toPub: string, messageId: string, fromAlias?: string, toAlias?: string) => void
  purgeStale: (maxAgeMs?: number) => void
}

export const useGraphStore = create<GraphState>((set, get) => ({
  nodes: [],
  edges: [],

  recordHop(fromPub, toPub, messageId, fromAlias, toAlias) {
    const now = Date.now()
    const { nodes, edges } = get()

    // Upsert source node
    const newNodes = [...nodes]
    const srcIdx = newNodes.findIndex((n) => n.id === fromPub)
    if (srcIdx >= 0) {
      newNodes[srcIdx] = { ...newNodes[srcIdx], lastActive: now, alias: fromAlias ?? newNodes[srcIdx].alias }
    } else {
      newNodes.push({ id: fromPub, alias: fromAlias ?? fromPub.slice(0, 8), lastActive: now })
    }

    // Upsert target node
    const tgtIdx = newNodes.findIndex((n) => n.id === toPub)
    if (tgtIdx >= 0) {
      newNodes[tgtIdx] = { ...newNodes[tgtIdx], lastActive: now, alias: toAlias ?? newNodes[tgtIdx].alias }
    } else {
      newNodes.push({ id: toPub, alias: toAlias ?? toPub.slice(0, 8), lastActive: now })
    }

    // Upsert edge
    const newEdges = [...edges]
    const edgeIdx = newEdges.findIndex(
      (e) =>
        (e.source === fromPub && e.target === toPub) ||
        (e.source === toPub && e.target === fromPub),
    )
    if (edgeIdx >= 0) {
      const e = newEdges[edgeIdx]
      newEdges[edgeIdx] = {
        ...e,
        lastPulsed: now,
        messageIds: [...new Set([...e.messageIds, messageId])],
      }
    } else {
      newEdges.push({ source: fromPub, target: toPub, lastPulsed: now, messageIds: [messageId] })
    }

    set({ nodes: newNodes, edges: newEdges })
  },

  purgeStale(maxAgeMs = 300_000) {
    const cutoff = Date.now() - maxAgeMs
    const { nodes, edges } = get()
    const activeIds = new Set(nodes.filter((n) => n.lastActive > cutoff).map((n) => n.id))
    set({
      nodes: nodes.filter((n) => activeIds.has(n.id)),
      edges: edges.filter((e) => activeIds.has(e.source) && activeIds.has(e.target)),
    })
  },
}))
