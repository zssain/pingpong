import { useState, useEffect } from 'react'
import { CheckCircle, AlertCircle, Ghost, Loader2 } from 'lucide-react'
import type { HopStamp } from '../types'
import { verify } from '../lib/crypto'

interface Props {
  messageId: string
  hops: HopStamp[]
  authorPubkey?: string
  authorAlias?: string
}

export function HopChain({ messageId, hops, authorPubkey, authorAlias }: Props) {
  const [hopResults, setHopResults] = useState<(boolean | null)[]>(
    hops.map(() => null),
  )
  const [verifying, setVerifying] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function verifyAll() {
      const results: boolean[] = []
      for (let i = 0; i < hops.length; i++) {
        const hop = hops[i]
        const prevSig = i === 0 ? '' : hops[i - 1].signature
        const payload = messageId + prevSig + hop.receivedAt
        const payloadBytes = new TextEncoder().encode(payload)
        try {
          const valid = await verify(hop.signature, payloadBytes, hop.relayerPubkey)
          results.push(valid)
        } catch {
          results.push(false)
        }
      }
      if (!cancelled) {
        setHopResults(results)
        setVerifying(false)
      }
    }

    if (hops.length > 0) {
      verifyAll()
    } else {
      setVerifying(false)
    }

    return () => { cancelled = true }
  }, [messageId, hops])

  return (
    <div className="space-y-0">
      {/* Author entry */}
      <div className="flex items-start gap-3">
        <div className="flex flex-col items-center">
          <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
            {authorPubkey ? (
              <CheckCircle size={14} className="text-blue-500" />
            ) : (
              <Ghost size={14} className="text-slate-400" />
            )}
          </div>
          {hops.length > 0 && (
            <div className="w-px h-6 bg-slate-200" />
          )}
        </div>
        <div className="pb-2 min-w-0">
          <p className="text-sm font-medium text-slate-700 truncate">
            {authorAlias ?? 'anonymous'}
          </p>
          <p className="text-xs text-slate-400">wrote this message</p>
        </div>
      </div>

      {/* Hop entries */}
      {hops.map((hop, i) => {
        const isLast = i === hops.length - 1
        const result = hopResults[i]
        const time = new Date(hop.receivedAt).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        })

        return (
          <div key={i} className="flex items-start gap-3">
            <div className="flex flex-col items-center">
              <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                {verifying ? (
                  <Loader2 size={14} className="text-slate-400 animate-spin" />
                ) : result ? (
                  <CheckCircle size={14} className="text-green-500" />
                ) : (
                  <AlertCircle size={14} className="text-amber-500" />
                )}
              </div>
              {!isLast && <div className="w-px h-6 bg-slate-200" />}
            </div>
            <div className="pb-2 min-w-0">
              <p className="text-sm font-medium text-slate-700 truncate">
                {hop.relayerAlias}
              </p>
              <p className="text-xs text-slate-400">relayed at {time}</p>
            </div>
          </div>
        )
      })}

      {hops.length === 0 && (
        <p className="text-xs text-slate-400 ml-9">
          This message hasn't been relayed yet — it only exists on this device.
        </p>
      )}
    </div>
  )
}
