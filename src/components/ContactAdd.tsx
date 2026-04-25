import { useState } from 'react'
import { X, QrCode, UserPlus } from 'lucide-react'
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
  const [error, setError] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)

  const myHandle = myPubkey ? pubkeyToHandle(myPubkey) : '...'

  async function resolveAndAdd(input: string) {
    setAdding(true); setError(null)
    try {
      if (/^[0-9a-f]{64}$/i.test(input)) {
        const handle = pubkeyToHandle(input)
        await addContact(input, handle); onClose(); return
      }
      const prefix = handleToPubkeyPrefix(input)
      const allPeers = await db.peers.toArray()
      const matches = allPeers.filter((p) => p.pubkey.startsWith(prefix))
      if (matches.length === 1) {
        const handle = pubkeyToHandle(matches[0].pubkey)
        await addContact(matches[0].pubkey, handle); onClose()
      } else if (matches.length > 1) {
        setError(`Multiple peers match. Sync with them first.`)
      } else {
        setError('No known peer matches this handle. Sync first.')
      }
    } catch { setError('Invalid handle format') }
    finally { setAdding(false) }
  }

  function onQRScanned(text: string) { setScanning(false); resolveAndAdd(text) }

  if (!open) return null

  return (
    <>
      <div
        className={`fixed inset-0 z-50 bg-bg/80 backdrop-blur-sm transition-opacity duration-200 ${open ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />
      <div className={`fixed inset-x-0 bottom-0 z-50 bg-surface border-t border-border-mid max-w-md mx-auto transition-transform duration-200 ease-out ${open ? 'translate-y-0' : 'translate-y-full'}`}>
        <div className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-mono uppercase tracking-wider text-text-muted">ADD CONTACT</h3>
            <button onClick={onClose} className="p-1 text-text-muted hover:text-text transition-colors duration-150">
              <X size={18} />
            </button>
          </div>

          {/* Your handle */}
          <div className="border border-border-mid p-4 text-center space-y-3">
            <p className="text-[10px] font-mono uppercase tracking-wider text-text-dim">YOUR HANDLE</p>
            <p className="text-base font-mono text-accent tracking-wider">{myHandle}</p>
            <p className="text-[10px] font-mono text-text-dim">Share this or show the QR below</p>
          </div>

          {/* Your QR */}
          {myPubkey && !scanning && (
            <div className="flex justify-center">
              <QRDisplay text={myPubkey} />
            </div>
          )}

          {/* Scan mode */}
          {scanning && (
            <div className="space-y-3">
              <QRScanner mode="single" onComplete={onQRScanned} />
              <button onClick={() => setScanning(false)} className="w-full text-[10px] font-mono uppercase tracking-wider text-text-muted hover:text-text transition-colors">CANCEL SCAN</button>
            </div>
          )}

          {/* Input their handle */}
          {!scanning && (
            <>
              <div className="flex items-center gap-3 py-1">
                <div className="flex-1 h-px bg-border" />
                <span className="text-[10px] font-mono uppercase tracking-wider text-text-dim">ADD THEIRS</span>
                <div className="flex-1 h-px bg-border" />
              </div>

              <input
                type="text"
                value={handleInput}
                onChange={(e) => setHandleInput(e.target.value.toUpperCase())}
                placeholder="Handle or full pubkey"
                className="w-full px-3 py-2.5 text-sm font-mono bg-surface-2 border border-border text-text placeholder:text-text-dim focus:outline-none focus:border-accent transition-colors duration-150"
              />

              {error && <p className="text-[10px] font-mono uppercase tracking-wider text-alert">{error}</p>}

              <div className="flex gap-2">
                <button
                  onClick={() => resolveAndAdd(handleInput)}
                  disabled={!handleInput.trim() || adding}
                  className={`flex-1 py-2.5 text-xs font-mono uppercase tracking-[0.2em] border flex items-center justify-center gap-1.5 transition-all duration-150 active:scale-[0.98] ${
                    handleInput.trim() && !adding
                      ? 'border-accent text-accent bg-accent/5 hover:bg-accent/15'
                      : 'border-border text-text-dim cursor-not-allowed'
                  }`}
                >
                  <UserPlus size={12} />
                  {adding ? 'ADDING...' : 'ADD'}
                </button>
                <button
                  onClick={() => setScanning(true)}
                  className="py-2.5 px-4 text-xs font-mono uppercase tracking-[0.2em] border border-border text-text-muted hover:border-border-mid hover:text-text transition-all duration-150 flex items-center gap-1.5"
                >
                  <QrCode size={12} />
                  SCAN
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  )
}
