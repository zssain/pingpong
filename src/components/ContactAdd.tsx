import { useState } from 'react'
import { X, QrCode, UserPlus, Camera } from 'lucide-react'
import { useIdentityStore } from '../store/identity'
import { useDmsStore } from '../store/dms'
import { pubkeyToHandle, handleToPubkeyPrefix } from '../lib/handle'
import { QRDisplay } from './QRDisplay'
import { QRScanner } from './QRScanner'
import { db } from '../db/schema'

interface Props {
  open: boolean
  onClose: () => void
}

export function ContactAdd({ open, onClose }: Props) {
  const myPubkey = useIdentityStore((s) => s.pubkey)
  const addContact = useDmsStore((s) => s.addContact)
  const [handleInput, setHandleInput] = useState('')
  const [scanning, setScanning] = useState(false)
  const [showMyQR, setShowMyQR] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)

  const myHandle = myPubkey ? pubkeyToHandle(myPubkey) : '...'

  async function resolveAndAdd(input: string) {
    setAdding(true); setError(null)
    try {
      // Full 64-char hex pubkey — add directly
      if (/^[0-9a-f]{64}$/i.test(input)) {
        const handle = pubkeyToHandle(input)
        await addContact(input, handle); onClose(); return
      }
      // Try as handle — search peers
      const prefix = handleToPubkeyPrefix(input)
      const allPeers = await db.peers.toArray()
      const matches = allPeers.filter((p) => p.pubkey.startsWith(prefix))
      if (matches.length === 1) {
        const handle = pubkeyToHandle(matches[0].pubkey)
        await addContact(matches[0].pubkey, handle); onClose()
      } else if (matches.length > 1) {
        setError('Multiple peers match. Try scanning their QR instead.')
      } else {
        setError('No match found. Scan their QR or paste their full pubkey.')
      }
    } catch { setError('Invalid handle format') }
    finally { setAdding(false) }
  }

  function onQRScanned(text: string) {
    setScanning(false)
    resolveAndAdd(text)
  }

  if (!open) return null

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 bg-bg/80 backdrop-blur-sm transition-opacity duration-200 ${open ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-sm max-h-[85vh] overflow-y-auto bg-surface border border-border-mid p-5 space-y-4"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-mono uppercase tracking-wider text-text-muted">ADD CONTACT</h3>
          <button onClick={onClose} className="p-1 text-text-muted hover:text-text transition-colors duration-150">
            <X size={18} />
          </button>
        </div>

        {/* Scan their QR — primary action */}
        {scanning ? (
          <div className="space-y-3">
            <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-text-muted text-center">SCAN THEIR QR</p>
            <QRScanner mode="single" onComplete={onQRScanned} />
            <button onClick={() => setScanning(false)} className="w-full text-[10px] font-mono uppercase tracking-wider text-text-muted hover:text-text transition-colors text-center">
              CANCEL
            </button>
          </div>
        ) : (
          <>
            {/* Two main actions */}
            <div className="space-y-2">
              <button
                onClick={() => setScanning(true)}
                className="w-full py-3 text-xs font-mono uppercase tracking-[0.2em] border border-accent text-accent bg-accent/5 hover:bg-accent/15 active:scale-[0.98] transition-all duration-150 flex items-center justify-center gap-2"
              >
                <Camera size={14} />
                SCAN THEIR QR
              </button>
              <button
                onClick={() => setShowMyQR(!showMyQR)}
                className="w-full py-3 text-xs font-mono uppercase tracking-[0.2em] border border-border text-text-muted hover:border-border-mid hover:text-text active:scale-[0.98] transition-all duration-150 flex items-center justify-center gap-2"
              >
                <QrCode size={14} />
                {showMyQR ? 'HIDE MY QR' : 'SHOW MY QR'}
              </button>
            </div>

            {/* My handle + QR (toggleable) */}
            {showMyQR && (
              <div className="space-y-3 animate-fade-in">
                <div className="border border-border-mid p-4 text-center space-y-2">
                  <p className="text-[10px] font-mono uppercase tracking-wider text-text-dim">YOUR HANDLE</p>
                  <p className="text-base font-mono text-accent tracking-wider">{myHandle}</p>
                </div>
                {myPubkey && (
                  <div className="flex justify-center">
                    <QRDisplay text={myPubkey} />
                  </div>
                )}
                <p className="text-[10px] font-mono text-text-dim text-center">
                  Others scan this to add you
                </p>
              </div>
            )}

            {/* Divider */}
            <div className="flex items-center gap-3 py-1">
              <div className="flex-1 h-px bg-border" />
              <span className="text-[10px] font-mono uppercase tracking-wider text-text-dim">OR PASTE</span>
              <div className="flex-1 h-px bg-border" />
            </div>

            {/* Manual input */}
            <input
              type="text"
              value={handleInput}
              onChange={(e) => setHandleInput(e.target.value.toUpperCase())}
              placeholder="Handle or full pubkey"
              className="w-full px-3 py-2.5 text-sm font-mono bg-surface-2 border border-border text-text placeholder:text-text-dim focus:outline-none focus:border-accent transition-colors duration-150"
            />

            {error && <p className="text-[10px] font-mono uppercase tracking-wider text-alert">{error}</p>}

            <button
              onClick={() => resolveAndAdd(handleInput)}
              disabled={!handleInput.trim() || adding}
              className={`w-full py-2.5 text-xs font-mono uppercase tracking-[0.2em] border flex items-center justify-center gap-1.5 transition-all duration-150 active:scale-[0.98] ${
                handleInput.trim() && !adding
                  ? 'border-accent text-accent bg-accent/5 hover:bg-accent/15'
                  : 'border-border text-text-dim cursor-not-allowed'
              }`}
            >
              <UserPlus size={12} />
              {adding ? 'ADDING...' : 'ADD CONTACT'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
