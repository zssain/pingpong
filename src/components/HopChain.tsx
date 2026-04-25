import { useState, useEffect } from 'react'
import { CheckCircle, AlertCircle, Ghost, Loader2, Pencil } from 'lucide-react'
import type { HopStamp } from '../types'
import { verify } from '../lib/crypto'
import { useIdentityStore } from '../store/identity'
import { timeAgo } from '../lib/timeago'

interface Props {
  messageId: string
  hops: HopStamp[]
  authorPubkey?: string
  authorAlias?: string
}

export function HopChain({ messageId, hops, authorPubkey, authorAlias }: Props) {
  const myPubkey = useIdentityStore((s) => s.pubkey)
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
      {/* Author (origin) entry */}
      <div className="flex items-start gap-3 animate-fade-in">
        <div className="flex flex-col items-center">
          <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center shrink-0 border border-slate-200">
            {authorPubkey ? (
              <Pencil size={13} className="text-blue-500" />
            ) : (
              <Ghost size={13} className="text-slate-400" />
            )}
          </div>
          {hops.length > 0 && (
            <div className="w-px flex-1 min-h-[20px] bg-slate-200" />
          )}
        </div>
        <div className="pb-3 min-w-0">
          <p className="text-sm font-medium text-slate-700 truncate">
            {authorAlias ?? 'anonymous'}
            {authorPubkey === myPubkey && (
              <span className="text-xs text-slate-400 font-normal ml-1">(you)</span>
            )}
          </p>
          <p className="text-xs text-slate-400">wrote this message</p>
        </div>
      </div>

      {/* Hop entries */}
      {hops.map((hop, i) => {
        const isLast = i === hops.length - 1
        const result = hopResults[i]
        const isYou = hop.relayerPubkey === myPubkey

        return (
          <div
            key={i}
            className="flex items-start gap-3 animate-fade-in"
            style={{ animationDelay: `${(i + 1) * 100}ms` }}
          >
            <div className="flex flex-col items-center">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 border text-xs font-bold ${
                  verifying
                    ? 'bg-slate-50 border-slate-200 text-slate-400'
                    : result
                      ? 'bg-green-50 border-green-200 text-green-600'
                      : 'bg-amber-50 border-amber-200 text-amber-600'
                } ${isLast ? 'animate-pulse-slow' : ''}`}
              >
                {verifying ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : result ? (
                  <span>{i + 1}</span>
                ) : (
                  <AlertCircle size={13} />
                )}
              </div>
              {!isLast && (
                <div className="w-px flex-1 min-h-[20px] bg-slate-200" />
              )}
            </div>
            <div className="pb-3 min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="text-sm font-medium text-slate-700 truncate">
                  {hop.relayerAlias}
                  {isYou && (
                    <span className="text-xs text-slate-400 font-normal ml-1">(you)</span>
                  )}
                </p>
                {!verifying && result && (
                  <CheckCircle size={12} className="text-green-500 shrink-0" />
                )}
              </div>
              <p className="text-xs text-slate-400">
                relayed {timeAgo(hop.receivedAt)}
              </p>
            </div>
          </div>
        )
      })}

      {hops.length === 0 && (
        <p className="text-xs text-slate-400 ml-10 animate-fade-in">
          This message hasn't been relayed yet — it only exists on this device.
        </p>
      )}
    </div>
  )
}
