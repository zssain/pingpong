import { useState, useEffect } from 'react'
import { ArrowRight, Wifi, QrCode, FileText, Shield } from 'lucide-react'
import { useIdentityStore } from '../store/identity'
import { db } from '../db/schema'

const FLAG = 'firstRunComplete'

export function FirstRun() {
  const alias = useIdentityStore((s) => s.alias)
  const [visible, setVisible] = useState(false)
  const [step, setStep] = useState(0)

  useEffect(() => {
    if (localStorage.getItem(FLAG)) return
    Promise.all([db.messages.count(), db.peers.count()]).then(([msgs, peers]) => {
      if (msgs === 0 && peers === 0) setVisible(true)
    })
  }, [])

  if (!visible || !alias) return null

  function finish() { localStorage.setItem(FLAG, '1'); setVisible(false) }

  const steps = [
    <div key="1" className="text-center space-y-5">
      <div className="relative w-20 h-20 mx-auto">
        <div className="absolute inset-0 border border-dashed border-accent-dim animate-spin-slow flex items-center justify-center">
          <div className="absolute inset-2 bg-surface-2 border border-border flex items-center justify-center">
            <span className="text-xs font-mono uppercase tracking-wider text-accent">{alias.split('-')[0]}</span>
          </div>
        </div>
      </div>
      <div>
        <h2 className="text-xs font-mono uppercase tracking-[0.2em] text-text-muted">
          YOU ARE <span className="text-accent">{alias.toUpperCase()}</span>
        </h2>
        <p className="text-xs font-mono text-text-muted mt-3 leading-relaxed max-w-xs mx-auto">
          Your name changes every day. No accounts. No email. No password. You are already part of the network.
        </p>
      </div>
    </div>,

    <div key="2" className="space-y-5">
      <h2 className="text-xs font-mono uppercase tracking-[0.2em] text-text-muted text-center">
        MESSAGES TRAVEL THROUGH PEOPLE
      </h2>
      <div className="space-y-2 max-w-xs mx-auto">
        {[
          { icon: Wifi, label: 'LOCAL WI-FI', sub: 'Fastest. No internet needed.' },
          { icon: QrCode, label: 'CAMERA-TO-CAMERA', sub: 'No network at all. Just screens.' },
          { icon: FileText, label: 'PRINTED POSTERS', sub: 'Dead drops. No battery needed.' },
        ].map(({ icon: Icon, label, sub }) => (
          <div key={label} className="flex items-center gap-3 border border-border p-3">
            <Icon size={14} className="text-accent shrink-0" />
            <div>
              <p className="text-[11px] font-mono uppercase tracking-wider text-text">{label}</p>
              <p className="text-[10px] font-mono text-text-dim">{sub}</p>
            </div>
          </div>
        ))}
      </div>
    </div>,

    <div key="3" className="text-center space-y-5">
      <div className="w-20 h-20 mx-auto border border-alert flex items-center justify-center">
        <Shield size={28} className="text-alert" />
      </div>
      <div>
        <h2 className="text-xs font-mono uppercase tracking-[0.2em] text-text-muted">
          TRIPLE-TAP THE TOP BAR TO ERASE EVERYTHING
        </h2>
        <p className="text-xs font-mono text-text-muted mt-3 leading-relaxed max-w-xs mx-auto">
          All messages, contacts, and identity destroyed in two seconds. A fresh key is generated. No trace remains.
        </p>
      </div>
    </div>,
  ]

  const isLast = step === steps.length - 1

  return (
    <div className="fixed inset-0 z-[80] bg-bg/95 backdrop-blur-md flex items-center justify-center p-6 animate-fade-in">
      <div className="relative bg-surface border border-border max-w-sm w-full p-8 space-y-6">
        {/* Step indicator */}
        <div className="flex justify-center gap-2">
          {steps.map((_, i) => (
            <div key={i} className={`w-2 h-2 transition-colors duration-200 ${i === step ? 'bg-accent' : 'bg-border'}`} />
          ))}
        </div>

        <div key={step} className="animate-fade-in">{steps[step]}</div>

        {isLast ? (
          <button onClick={finish} className="w-full py-3 text-xs font-mono uppercase tracking-[0.2em] border border-accent text-accent bg-accent/5 hover:bg-accent/15 active:scale-[0.98] transition-all duration-150">
            GET STARTED
          </button>
        ) : (
          <>
            <button onClick={() => setStep(step + 1)} className="w-full py-3 text-xs font-mono uppercase tracking-[0.2em] border border-accent text-accent bg-accent/5 hover:bg-accent/15 active:scale-[0.98] transition-all duration-150 flex items-center justify-center gap-2">
              NEXT <ArrowRight size={14} />
            </button>
            <button onClick={finish} className="w-full text-[10px] font-mono uppercase tracking-wider text-text-muted hover:text-text transition-colors text-center">
              SKIP
            </button>
          </>
        )}
      </div>
    </div>
  )
}
