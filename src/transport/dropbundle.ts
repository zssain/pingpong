/**
 * Tier 3: QR dead-drop bundles.
 *
 * A drop bundle is a snapshot of community content — recent news + top alerts —
 * compressed into an animated QR sequence that can be printed as a poster.
 * Anyone can scan it, anyone can print a new one.
 */

import type { Message, Identity } from '../types'
import { getVisibleMessages } from '../db'
import { ingestReceivedMessage } from '../sync/protocol'
import { gzipString, gunzipString, uint8ToBase64, base64ToUint8 } from '../lib/compress'

interface DropEnvelope {
  v: 1
  createdAt: number
  messages: Message[]
}

interface BundleOpts {
  includeNews?: boolean
  newsLimit?: number
  includeAlerts?: boolean
  alertLimit?: number
}

/**
 * Build a drop bundle: recent news + alerts → JSON → gzip → base64.
 */
export async function buildDropBundle(opts: BundleOpts = {}): Promise<string> {
  const {
    includeNews = true,
    newsLimit = 10,
    includeAlerts = true,
    alertLimit = 3,
  } = opts

  const messages: Message[] = []

  if (includeAlerts) {
    const alerts = await getVisibleMessages('alert')
    messages.push(...alerts.slice(0, alertLimit))
  }

  if (includeNews) {
    const news = await getVisibleMessages('news')
    messages.push(...news.slice(0, newsLimit))
  }

  const envelope: DropEnvelope = {
    v: 1,
    createdAt: Date.now(),
    messages,
  }

  const json = JSON.stringify(envelope)
  const compressed = await gzipString(json)
  return uint8ToBase64(compressed)
}

/**
 * Parse a drop bundle back into its envelope.
 */
export async function parseDropBundle(b64: string): Promise<DropEnvelope> {
  const compressed = base64ToUint8(b64)
  const json = await gunzipString(compressed)
  return JSON.parse(json) as DropEnvelope
}

/**
 * Ingest all messages from a scanned drop bundle.
 */
export async function ingestDropBundle(
  b64: string,
  myIdentity: Identity,
  myAlias: string,
): Promise<{ accepted: number; rejected: number; createdAt: number }> {
  const envelope = await parseDropBundle(b64)
  let accepted = 0
  let rejected = 0

  for (const msg of envelope.messages) {
    const result = await ingestReceivedMessage(msg, myIdentity, myAlias)
    if (result.accepted) {
      accepted++
    } else {
      rejected++
    }
  }

  return { accepted, rejected, createdAt: envelope.createdAt }
}
