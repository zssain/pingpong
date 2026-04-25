interface Props {
  phase: 'handshaking' | 'syncing' | 'complete'
  received?: number
  total?: number
}

export function SyncProgress({ phase, received, total }: Props) {
  return (
    <div className="flex items-center justify-center gap-2 text-[11px] font-mono uppercase tracking-wider text-text-muted">
      {phase === 'handshaking' && (
        <>
          <span className="w-1.5 h-1.5 bg-accent animate-pulse" />
          <span>HANDSHAKING</span>
        </>
      )}
      {phase === 'syncing' && (
        <>
          <span className="w-1.5 h-1.5 bg-accent animate-pulse" />
          <span>
            SYNCING
            {received != null && total != null && total > 0
              ? ` — ${received} / ${total}`
              : ''}
          </span>
        </>
      )}
      {phase === 'complete' && (
        <>
          <span className="w-1.5 h-1.5 bg-success" />
          <span>COMPLETE</span>
        </>
      )}
    </div>
  )
}
