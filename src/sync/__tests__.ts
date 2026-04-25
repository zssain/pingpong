/**
 * Sync engine integration test.
 *
 * Simulates two devices (Alice and Bob) doing a full sync:
 * 1. Alice creates 5 messages.
 * 2. Alice builds a Bloom filter fingerprint.
 * 3. Bob (empty) computes which messages he's missing.
 * 4. Alice packs those messages for transfer.
 * 5. Bob ingests each message.
 * 6. We verify Bob has all 5, each with exactly one hop (Bob's relay stamp).
 *
 * This runs automatically in DEV mode on app startup.
 */

import { generateKeypair } from '../lib/crypto'
import { deriveAlias } from '../lib/identity'
import { canonicalize, computeMessageId } from '../lib/canonical'
import { signMessage } from '../lib/identity'
import { BloomFilter } from './bloom'
import {
  buildLocalFingerprint,
  computeMissingIds,
  packMessagesForSend,
  ingestReceivedMessage,
} from './protocol'
import { db } from '../db/schema'
import type { Message, Identity } from '../types'
import { PRIORITY, TTL } from '../types'

let testRunning = false

async function makeIdentity(): Promise<Identity> {
  const kp = await generateKeypair()
  return {
    key: 'self',
    privateKey: kp.privateKey,
    publicKey: kp.publicKey,
    createdAt: Date.now(),
  }
}

async function createTestMessage(
  content: string,
  alice: Identity,
  aliceAlias: string,
): Promise<Message> {
  const timestamp = Date.now()
  const msg: Message = {
    id: '',
    type: 'news',
    content,
    authorPubkey: alice.publicKey,
    authorAlias: aliceAlias,
    timestamp,
    ttl: timestamp + TTL.NEWS,
    priority: PRIORITY.NEWS,
    hops: [],
  }
  // Compute ID, then sign
  msg.id = await computeMessageId(msg)
  const canonical = canonicalize(msg)
  msg.signature = await signMessage(canonical, alice.privateKey)
  return msg
}

export async function runSyncTests(): Promise<void> {
  // Guard against StrictMode double-invocation
  if (testRunning) return
  testRunning = true

  console.log('[sync-test] ─── Starting sync engine tests ───')

  // Clean slate for tests
  await db.messages.clear()
  await db.peers.clear()

  // ── Setup: create two identities ──────────────────────────────
  const alice = await makeIdentity()
  const aliceAlias = await deriveAlias(alice.publicKey)
  const bob = await makeIdentity()
  const bobAlias = await deriveAlias(bob.publicKey)

  console.log(`[sync-test] Alice: ${aliceAlias} (${alice.publicKey.slice(0, 8)}...)`)
  console.log(`[sync-test] Bob:   ${bobAlias} (${bob.publicKey.slice(0, 8)}...)`)

  // ── Step 1: Alice creates 5 messages ──────────────────────────
  const aliceMessages: Message[] = []
  for (let i = 0; i < 5; i++) {
    const msg = await createTestMessage(`Test message #${i + 1} from Alice`, alice, aliceAlias)
    aliceMessages.push(msg)
    // Store in DB as if Alice created them locally
    await db.messages.put(msg)
  }
  console.log(`[sync-test] Alice created ${aliceMessages.length} messages`)

  // ── Step 2: Alice builds her fingerprint ──────────────────────
  const aliceFingerprint = await buildLocalFingerprint()
  console.log(`[sync-test] Alice fingerprint: ${aliceFingerprint.length} bytes`)

  // ── Step 3: Bob checks what he's missing ──────────────────────
  // Bob has no messages, so his filter is empty. He checks Alice's IDs
  // against his own empty filter — but actually we need to think about
  // this correctly: Bob receives Alice's fingerprint, and Alice receives
  // Bob's fingerprint. Each side then checks their OWN IDs against the
  // PEER's filter to find what the peer is missing.
  //
  // Since Bob has nothing, Alice's computeMissingIds against Bob's empty
  // filter should return all 5 IDs.
  const bobFingerprint = new BloomFilter().serialize() // empty
  const missingIds = await computeMissingIds(bobFingerprint)
  console.log(`[sync-test] Bob is missing ${missingIds.length} messages`)

  let pass = missingIds.length === 5
  console.log(`[sync-test] ${pass ? 'PASS' : 'FAIL'} — expected 5 missing, got ${missingIds.length}`)

  // ── Step 4: Alice packs messages for transfer ─────────────────
  const packed = await packMessagesForSend(missingIds)
  console.log(`[sync-test] Packed ${packed.length} messages for transfer`)

  // ── Step 5: Bob ingests each message ──────────────────────────
  // First clear DB to simulate Bob's empty state
  await db.messages.clear()

  let accepted = 0
  for (const msg of packed) {
    // Deep copy so ingest can mutate hops without affecting our reference
    const copy = JSON.parse(JSON.stringify(msg)) as Message
    const result = await ingestReceivedMessage(copy, bob, bobAlias)
    if (result.accepted) {
      accepted++
    } else {
      console.log(`[sync-test] Rejected: ${result.reason}`)
    }
  }

  console.log(`[sync-test] Bob accepted ${accepted}/${packed.length} messages`)
  pass = accepted === 5
  console.log(`[sync-test] ${pass ? 'PASS' : 'FAIL'} — expected 5 accepted`)

  // ── Step 6: Verify Bob has all 5 with one hop each ────────────
  const bobMessages = await db.messages.toArray()
  const allHaveOneHop = bobMessages.every((m) => m.hops.length === 1)
  const allHopsByBob = bobMessages.every(
    (m) => m.hops[0]?.relayerPubkey === bob.publicKey,
  )

  console.log(`[sync-test] Bob has ${bobMessages.length} messages in DB`)
  console.log(
    `[sync-test] ${allHaveOneHop ? 'PASS' : 'FAIL'} — each message has exactly 1 hop`,
  )
  console.log(
    `[sync-test] ${allHopsByBob ? 'PASS' : 'FAIL'} — all hops are by Bob`,
  )

  // ── Step 7: Verify dedup works ────────────────────────────────
  const dupResult = await ingestReceivedMessage(
    JSON.parse(JSON.stringify(packed[0])) as Message,
    bob,
    bobAlias,
  )
  const dedupWorks = !dupResult.accepted && dupResult.reason?.includes('dedupe')
  console.log(
    `[sync-test] ${dedupWorks ? 'PASS' : 'FAIL'} — duplicate correctly rejected`,
  )

  // Clean up test data
  await db.messages.clear()
  await db.peers.clear()

  console.log('[sync-test] ─── Sync engine tests complete ───')
}
