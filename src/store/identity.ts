import { create } from 'zustand'
import { getOrCreateIdentity, wipeIdentity } from '../db'
import { deriveAlias } from '../lib/identity'

interface IdentityState {
  pubkey: string | null
  alias: string | null
  loadIdentity: () => Promise<void>
  wipe: () => Promise<void>
}

export const useIdentityStore = create<IdentityState>((set) => ({
  pubkey: null,
  alias: null,

  async loadIdentity() {
    const identity = await getOrCreateIdentity()
    const alias = await deriveAlias(identity.publicKey)
    console.log(`[identity] pubkey: ${identity.publicKey}`)
    console.log(`[identity] alias:  ${alias}`)
    set({ pubkey: identity.publicKey, alias })
  },

  async wipe() {
    await wipeIdentity()
    // Reload to get fresh state everywhere
    window.location.reload()
  },
}))
