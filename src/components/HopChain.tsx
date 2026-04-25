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
          <div className="w-7 h-7 flex items-center justify-center shrink-0 border border-border bg-surface-2">
            {authorPubkey ? (
              <Pencil size={12} className="text-accent" />
            ) : (
              <Ghost size={12} className="text-text-dim" />
            )}
          </div>
          {hops.length > 0 && (
            <div className="w-px flex-1 min-h-[20px] bg-border" />
          )}
        </div>
        <div className="pb-3 min-w-0">
          <p className="text-xs font-mono text-text truncate">
            {authorAlias ?? 'anonymous'}
            {authorPubkey === myPubkey && (
              <span className="text-[10px] font-mono uppercase tracking-wider text-text-dim ml-1">(YOU)</span>
            )}
          </p>
          <p className="text-[10px] font-mono uppercase tracking-wider text-text-dim">WROTE THIS MESSAGE</p>
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
                className={`w-7 h-7 flex items-center justify-center shrink-0 border text-[11px] font-mono ${
                  verifying
                    ? 'bg-surface-2 border-border text-text-dim'
                    : result
                      ? 'bg-accent-glow border-accent text-accent'
                      : 'bg-alert/10 border-alert text-alert'
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
                <div className="w-px flex-1 min-h-[20px] bg-border" />
              )}
            </div>
            <div className="pb-3 min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="text-xs font-mono text-text truncate">
                  {hop.relayerAlias}
                  {isYou && (
                    <span className="text-[10px] font-mono uppercase tracking-wider text-text-dim ml-1">(YOU)</span>
                  )}
                </p>
                {!verifying && result && (
                  <CheckCircle size={11} className="text-accent shrink-0" />
                )}
                {!verifying && !result && (
                  <AlertCircle size={11} className="text-alert shrink-0" />
                )}
              </div>
              <p className="text-[10px] font-mono uppercase tracking-wider text-text-dim">
                RELAYED {timeAgo(hop.receivedAt).toUpperCase()}
              </p>
            </div>
          </div>
        )
      })}

      {hops.length === 0 && (
        <p className="text-[10px] font-mono uppercase tracking-wider text-text-dim ml-10 animate-fade-in">
          NOT RELAYED YET — ONLY ON THIS DEVICE
        </p>
      )}
    </div>
  )
}
