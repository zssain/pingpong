interface Props {
  phase: 'handshaking' | 'syncing' | 'complete'
  received?: number
  total?: number
}

function AnimatedDots() {
  return (
    <span className="inline-flex w-6">
      <span className="animate-pulse">.</span>
      <span className="animate-pulse" style={{ animationDelay: '200ms' }}>.</span>
      <span className="animate-pulse" style={{ animationDelay: '400ms' }}>.</span>
    </span>
  )
}

export function SyncProgress({ phase, received, total }: Props) {
  return (
    <div className="flex items-center gap-2 text-sm text-slate-600">
      {phase === 'handshaking' && (
        <>
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
          <span>Handshaking<AnimatedDots /></span>
        </>
      )}
      {phase === 'syncing' && (
        <>
          <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
          <span>
            Syncing
            {received != null && total != null && total > 0
              ? ` — ${received} / ${total}`
              : ''}
            <AnimatedDots />
          </span>
        </>
      )}
      {phase === 'complete' && (
        <>
          <span className="w-2 h-2 rounded-full bg-green-500" />
          <span>Complete</span>
        </>
      )}
    </div>
  )
}
