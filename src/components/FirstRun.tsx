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

    // Check if this is truly a fresh device
    Promise.all([
      db.messages.count(),
      db.peers.count(),
    ]).then(([msgs, peers]) => {
      if (msgs === 0 && peers === 0) setVisible(true)
    })
  }, [])

  if (!visible || !alias) return null

  function finish() {
    localStorage.setItem(FLAG, '1')
    setVisible(false)
  }

  const steps = [
    // Step 1: Identity
    <div key="1" className="text-center space-y-6">
      <div className="relative w-24 h-24 mx-auto">
        <div className="absolute inset-0 rounded-full border-2 border-dashed border-slate-300 animate-spin-slow" />
        <div className="absolute inset-2 rounded-full bg-slate-100 flex items-center justify-center">
          <span className="text-sm font-bold text-slate-700">{alias.split('-')[0]}</span>
        </div>
      </div>
      <div>
        <h2 className="text-xl font-bold text-slate-900">
          You are <span className="text-[#0B3D91]">{alias}</span>
        </h2>
        <p className="text-sm text-slate-500 mt-2 leading-relaxed max-w-xs mx-auto">
          Your name changes every day. There are no accounts. No email. No password.
          You are already part of the mesh.
        </p>
      </div>
    </div>,

    // Step 2: Three tiers
    <div key="2" className="text-center space-y-6">
      <h2 className="text-xl font-bold text-slate-900">
        Messages travel through people
      </h2>
      <div className="space-y-3 max-w-xs mx-auto">
        <div className="flex items-center gap-3 bg-slate-50 rounded-lg p-3">
          <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
            <Wifi size={18} className="text-[#0B3D91]" />
          </div>
          <div className="text-left">
            <p className="text-sm font-medium text-slate-800">Local Wi-Fi</p>
            <p className="text-xs text-slate-500">Fastest. No internet needed.</p>
          </div>
        </div>
        <div className="flex items-center gap-3 bg-slate-50 rounded-lg p-3">
          <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
            <QrCode size={18} className="text-[#0B3D91]" />
          </div>
          <div className="text-left">
            <p className="text-sm font-medium text-slate-800">Camera-to-camera</p>
            <p className="text-xs text-slate-500">No network at all. Just screens.</p>
          </div>
        </div>
        <div className="flex items-center gap-3 bg-slate-50 rounded-lg p-3">
          <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
            <FileText size={18} className="text-[#0B3D91]" />
          </div>
          <div className="text-left">
            <p className="text-sm font-medium text-slate-800">Printed posters</p>
            <p className="text-xs text-slate-500">Dead drops. No battery needed.</p>
          </div>
        </div>
      </div>
    </div>,

    // Step 3: Panic wipe
    <div key="3" className="text-center space-y-6">
      <div className="relative w-24 h-24 mx-auto">
        <div className="absolute inset-0 rounded-full bg-red-50 flex items-center justify-center">
          <Shield size={32} className="text-red-500" />
        </div>
      </div>
      <div>
        <h2 className="text-xl font-bold text-slate-900">
          Triple-tap to erase everything
        </h2>
        <p className="text-sm text-slate-500 mt-2 leading-relaxed max-w-xs mx-auto">
          Tap the top bar three times. All messages, contacts, and your identity are destroyed
          in two seconds. A fresh key is generated. No trace remains.
        </p>
      </div>
    </div>,
  ]

  const isLast = step === steps.length - 1

  return (
    <div className="fixed inset-0 z-[90] bg-white flex flex-col animate-fade-in">
      {/* Progress dots */}
      <div className="flex justify-center gap-2 pt-8 pb-4">
        {steps.map((_, i) => (
          <div
            key={i}
            className={`w-2 h-2 rounded-full transition-colors duration-200 ${
              i === step ? 'bg-slate-900' : 'bg-slate-200'
            }`}
          />
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 flex items-center justify-center px-6">
        <div key={step} className="animate-fade-in">
          {steps[step]}
        </div>
      </div>

      {/* Footer */}
      <div className="p-6 pb-10">
        {isLast ? (
          <button
            onClick={finish}
            className="w-full py-3 rounded-lg bg-slate-900 text-white text-sm font-medium active:bg-slate-800 transition-colors duration-150"
          >
            Get started
          </button>
        ) : (
          <button
            onClick={() => setStep(step + 1)}
            className="w-full py-3 rounded-lg bg-[#0B3D91] text-white text-sm font-medium active:bg-[#092d6d] transition-colors duration-150 flex items-center justify-center gap-2"
          >
            Next
            <ArrowRight size={16} />
          </button>
        )}
        {!isLast && (
          <button
            onClick={finish}
            className="w-full text-xs text-slate-400 mt-3 text-center"
          >
            Skip
          </button>
        )}
      </div>
    </div>
  )
}
