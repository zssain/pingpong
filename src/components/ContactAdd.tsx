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
    setAdding(true)
    setError(null)

    try {
      // Check if it's a full hex pubkey (64 chars)
      if (/^[0-9a-f]{64}$/i.test(input)) {
        const handle = pubkeyToHandle(input)
        await addContact(input, handle)
        onClose()
        return
      }

      // Otherwise treat as handle — extract prefix and search peers
      const prefix = handleToPubkeyPrefix(input)
      const allPeers = await db.peers.toArray()
      const matches = allPeers.filter((p) => p.pubkey.startsWith(prefix))

      if (matches.length === 1) {
        const handle = pubkeyToHandle(matches[0].pubkey)
        await addContact(matches[0].pubkey, handle)
        onClose()
      } else if (matches.length > 1) {
        setError(`Multiple peers match "${input}". Sync with them first for a unique match.`)
      } else {
        setError('No known peer matches this handle. Sync with them first.')
      }
    } catch {
      setError('Invalid handle format')
    } finally {
      setAdding(false)
    }
  }

  function onQRScanned(text: string) {
    setScanning(false)
    // The QR contains the full pubkey hex
    resolveAndAdd(text)
  }

  if (!open) return null

  return (
    <>
      <div
        className={`fixed inset-0 z-50 bg-black/30 transition-opacity duration-200 ${open ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />
      <div className={`fixed inset-x-0 bottom-0 z-50 bg-white rounded-t-2xl shadow-2xl max-w-md mx-auto transition-transform duration-200 ease-out ${open ? 'translate-y-0' : 'translate-y-full'}`}>
        <div className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-slate-900">Add contact</h3>
            <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 transition-colors duration-150">
              <X size={20} />
            </button>
          </div>

          {/* Your handle */}
          <div className="bg-slate-50 rounded-lg p-3 text-center">
            <p className="text-xs text-slate-500 mb-1">Your handle</p>
            <p className="text-lg font-mono font-bold text-slate-900 tracking-wider">{myHandle}</p>
            <p className="text-[10px] text-slate-400 mt-1">Share this or show the QR below</p>
          </div>

          {/* Your QR */}
          {myPubkey && !scanning && (
            <div className="flex justify-center">
              <QRDisplay text={myPubkey} />
            </div>
          )}

          {/* Scan mode */}
          {scanning && (
            <div className="space-y-2">
              <QRScanner mode="single" onComplete={onQRScanned} />
              <button onClick={() => setScanning(false)} className="w-full text-xs text-slate-400 underline">Cancel scan</button>
            </div>
          )}

          {/* Input their handle */}
          {!scanning && (
            <>
              <div className="flex items-center gap-3 py-1">
                <div className="flex-1 h-px bg-slate-200" />
                <span className="text-xs text-slate-400">add theirs</span>
                <div className="flex-1 h-px bg-slate-200" />
              </div>

              <input
                type="text"
                value={handleInput}
                onChange={(e) => setHandleInput(e.target.value.toUpperCase())}
                placeholder="Handle (e.g. BF7K-QR2N) or full pubkey"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-slate-50 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400 font-mono"
              />

              {error && <p className="text-xs text-red-500">{error}</p>}

              <div className="flex gap-2">
                <button
                  onClick={() => resolveAndAdd(handleInput)}
                  disabled={!handleInput.trim() || adding}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-medium flex items-center justify-center gap-1.5 transition-colors duration-150 ${
                    handleInput.trim() && !adding
                      ? 'bg-slate-900 text-white active:bg-slate-800'
                      : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  }`}
                >
                  <UserPlus size={14} />
                  {adding ? 'Adding...' : 'Add'}
                </button>
                <button
                  onClick={() => setScanning(true)}
                  className="py-2.5 px-4 rounded-lg border border-slate-200 text-slate-700 text-sm font-medium active:bg-slate-50 transition-colors duration-150 flex items-center gap-1.5"
                >
                  <QrCode size={14} />
                  Scan QR
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  )
}
