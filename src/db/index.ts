export { db } from './schema'
export { getOrCreateIdentity, wipeIdentity } from './identity'
export {
  addMessage,
  getMessage,
  getVisibleMessages,
  hasMessage,
  getAllMessageIds,
} from './messages'
export { upsertPeer, getKnownPeers } from './peers'
export { startTtlSweeper } from './sweeper'
