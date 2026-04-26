/**
 * Sync protocol — the four phases of gossip-based message exchange.
 *
 * Phase 1: Fingerprint exchange — each side builds a Bloom filter and sends it.
 * Phase 2: Delta compute — each side checks IDs against the peer's filter.
 * Phase 3: Transfer — missing messages are sent, priority-first.
 * Phase 4: Merge & sweep — incoming messages are verified, hop-stamped, stored.
 *
 * This module implements the functions for each phase. The transport layer
 * (WebRTC or QR) calls these functions — the protocol itself is transport-agnostic.
 */

import type { Message, Identity } from '../types'
import { BloomFilter } from './bloom'
import { createHopStamp, verifyHopStamp } from './hopstamp'
import { canonicalize, computeMessageId } from '../lib/canonical'
import { verifyMessage } from '../lib/identity'
import {
  getAllMessageIds,
  getMessage,
  hasMessage,
  addMessage,
} from '../db'
import { upsertPeer } from '../db/peers'

// ─── Phase 1: Fingerprint ────────────────────────────────────────────

/**
 * Build a Bloom filter fingerprint of all our local messages.
 * The serialized result (~1 KB) is sent to the peer.
 */
export async function buildLocalFingerprint(): Promise<Uint8Array> {
  const ids = await getAllMessageIds()
  const filter = await BloomFilter.fromIds(ids)
  return filter.serialize()
}

// ─── Phase 2: Delta compute ──────────────────────────────────────────

/**
 * Given the peer's Bloom filter, figure out which of our messages
 * they probably don't have.
 *
 * We check each of our local IDs against the peer's filter. If the filter
 * says "not present," the peer definitely doesn't have it. If the filter says
 * "present," it might be a false positive (~1%), so we skip it.
 *
 * Results are sorted by priority (alerts first) then timestamp (newest first)
 * so the most important messages are transferred first.
 */
export async function computeMissingIds(
  peerFingerprint: Uint8Array,
): Promise<string[]> {
  const peerFilter = BloomFilter.deserialize(peerFingerprint)
  const localIds = await getAllMessageIds()

  const missing: { id: string; priority: number; timestamp: number }[] = []

  for (const id of localIds) {
    const inPeer = await peerFilter.has(id)
    if (!inPeer) {
      const msg = await getMessage(id)
      if (msg) {
        missing.push({ id, priority: msg.priority, timestamp: msg.timestamp })
      }
    }
  }

  // Sort: highest priority first, then newest first
  missing.sort((a, b) => b.priority - a.priority || b.timestamp - a.timestamp)

  return missing.map((m) => m.id)
}

// ─── Phase 3: Transfer ───────────────────────────────────────────────

/**
 * Load full message objects for a list of IDs, ready to send to the peer.
 */
export async function packMessagesForSend(
  ids: string[],
): Promise<Message[]> {
  const messages: Message[] = []
  for (const id of ids) {
    const msg = await getMessage(id)
    if (msg) messages.push(msg)
  }
  return messages
}

// ─── Phase 4: Ingest ─────────────────────────────────────────────────

/**
 * Ingest a message received from a peer.
 *
 * This is the most important function in the entire app. It runs every
 * validation check defined in the spec before storing a message, and
 * it appends our own hop stamp to prove we relayed it.
 *
 * @param msg        - The incoming message from the peer.
 * @param myIdentity - Our device's identity (for creating our hop stamp).
 * @param myAlias    - Our current daily alias.
 * @returns { accepted: true } if stored, or { accepted: false, reason } if rejected.
 */
export async function ingestReceivedMessage(
  msg: Message,
  myIdentity: Identity,
  myAlias: string,
): Promise<{ accepted: boolean; reason?: string }> {
  // ── Step 1: Verify content-addressed ID ──────────────────────────
  // Recompute the ID from the message content. If it doesn't match
  // what the sender claims, the message has been tampered with.
  const expectedId = await computeMessageId(msg)
  if (expectedId !== msg.id) {
    console.warn('[ingest] ID mismatch:', { expected: expectedId, got: msg.id, type: msg.type, content: msg.content.slice(0, 50) })
    return { accepted: false, reason: 'ID mismatch — message may be tampered' }
  }

  // ── Step 2: Enforce signed-alerts rule ───────────────────────────
  // Alerts MUST be signed so civilians can trust life-safety info.
  // An unsigned alert is silently dropped — it won't propagate.
  if (msg.type === 'alert' && !msg.signature) {
    return { accepted: false, reason: 'Unsigned alert — alerts must be signed' }
  }

  // ── Step 3: Verify author signature (if present) ─────────────────
  // If the message claims to be signed, verify the Ed25519 signature
  // against the canonical form and the claimed public key.
  if (msg.signature && msg.authorPubkey) {
    const canonical = canonicalize(msg)
    const valid = await verifyMessage(msg.signature, canonical, msg.authorPubkey)
    if (!valid) {
      console.warn('[ingest] Sig invalid:', { type: msg.type, id: msg.id.slice(0, 8), canonical: new TextDecoder().decode(canonical).slice(0, 100) })
      return { accepted: false, reason: 'Invalid author signature' }
    }
  }

  // ── Step 4: Verify every hop stamp in the chain ──────────────────
  // Each hop's signature covers (messageId + prevHopSig + receivedAt).
  // If any hop fails verification, the chain of custody is broken.
  for (let i = 0; i < msg.hops.length; i++) {
    const prevSig = i === 0 ? null : msg.hops[i - 1].signature
    const valid = await verifyHopStamp(msg.hops[i], msg.id, prevSig)
    if (!valid) {
      return {
        accepted: false,
        reason: `Invalid hop stamp at index ${i} (relayer: ${msg.hops[i].relayerAlias})`,
      }
    }
  }

  // ── Step 5: Deduplicate ──────────────────────────────────────────
  // Content-addressed IDs mean identical messages produce the same ID.
  // If we already have this message, skip — no need to re-verify or re-store.
  if (await hasMessage(msg.id)) {
    return { accepted: false, reason: 'Already have this message (dedupe)' }
  }

  console.log('[ingest] Accepting:', { type: msg.type, id: msg.id.slice(0, 8) })

  // ── Step 6: Append our own hop stamp ─────────────────────────────
  // We're relaying this message, so we add our own signed stamp to prove
  // we handled it. The previous hop's signature (or null) chains our stamp
  // to the rest of the chain.
  const prevSig =
    msg.hops.length > 0 ? msg.hops[msg.hops.length - 1].signature : null
  const ourStamp = await createHopStamp(
    msg.id,
    prevSig,
    Date.now(),
    myIdentity.publicKey,
    myAlias,
    myIdentity.privateKey,
  )
  msg.hops.push(ourStamp)

  // ── Step 7: Store the message ────────────────────────────────────
  // addMessage handles the replacement logic: if msg.replaces points to
  // an existing message with the same authorPubkey, the old one is hidden.
  msg.hidden = false
  await addMessage(msg)

  // Notify UI that a new message arrived (for arrival animation + graph)
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('mesh:message-arrived', { detail: { id: msg.id } }))
    // Record hop for mesh graph visualization
    if (msg.authorPubkey) {
      window.dispatchEvent(new CustomEvent('mesh:record-hop', {
        detail: { from: msg.authorPubkey, to: myIdentity.publicKey, msgId: msg.id, fromAlias: msg.authorAlias, toAlias: myAlias }
      }))
    }
  }

  // ── Step 8: Record the peers we've seen ──────────────────────────
  // Register every relayer in the hop chain as a known peer so the
  // mesh-graph visualization can show the network topology.
  for (const hop of msg.hops) {
    if (hop.relayerPubkey !== myIdentity.publicKey) {
      await upsertPeer(hop.relayerPubkey, hop.relayerAlias)
    }
  }
  // Also register the author as a peer (if signed)
  if (msg.authorPubkey && msg.authorAlias) {
    await upsertPeer(msg.authorPubkey, msg.authorAlias)
  }

  return { accepted: true }
}
