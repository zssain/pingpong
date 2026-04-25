import type { Message } from '../types'
import { PRIORITY, TTL } from '../types'
import { useIdentityStore } from '../store/identity'
import { getOrCreateIdentity } from '../db'
import { deriveAlias, signMessage } from './identity'
import { canonicalize, computeMessageId } from './canonical'
import type { Zone, AlertCategory } from './zones'

interface CreateArgs {
  type: 'news' | 'alert' | 'drop'
  content: string
  anonymous?: boolean
  location?: string
  replaces?: string
  zone?: Zone
  alertCategory?: AlertCategory
}

/**
 * Build a fully-formed local Message ready for storage and sync.
 */
export async function createLocalMessage(args: CreateArgs): Promise<Message> {
  const { type, content, anonymous = false, location, replaces, zone, alertCategory } = args

  if (type === 'alert' && !location) {
    throw new Error('Alerts require a location (e.g. "Central Clinic, Main Road")')
  }
  if (type === 'alert' && anonymous) {
    throw new Error('Alerts must be signed — anonymous alerts are not allowed')
  }

  const ttlKey = type.toUpperCase() as keyof typeof TTL
  const priorityKey = type.toUpperCase() as keyof typeof PRIORITY
  const timestamp = Date.now()

  const msg: Message = {
    id: '',
    type,
    content,
    timestamp,
    ttl: timestamp + TTL[ttlKey],
    priority: PRIORITY[priorityKey],
    hops: [],
  }

  if (location) {
    // Prefix location with alert category if provided
    msg.location = alertCategory ? `[${alertCategory}] ${location}` : location
  }
  if (replaces) msg.replaces = replaces
  if (zone && zone !== 'all') msg.zone = zone

  if (!anonymous) {
    const identity = await getOrCreateIdentity()
    const storeAlias = useIdentityStore.getState().alias
    const alias = storeAlias ?? await deriveAlias(identity.publicKey)

    msg.authorPubkey = identity.publicKey
    msg.authorAlias = alias

    msg.id = await computeMessageId(msg)
    const canonical = canonicalize(msg)
    msg.signature = await signMessage(canonical, identity.privateKey)
  } else {
    msg.id = await computeMessageId(msg)
  }

  return msg
}
