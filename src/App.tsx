import { useState, useEffect } from 'react'
import { startTtlSweeper } from './db'
import { useIdentityStore } from './store/identity'
import { useUiStore } from './store/ui'
import { Layout } from './components/Layout'
import { ComposeModal } from './components/ComposeModal'
import { MessageDetailModal } from './components/MessageDetailModal'
import { FeedScreen } from './screens/FeedScreen'
import { DmsScreen } from './screens/DmsScreen'
import { AlertsScreen } from './screens/AlertsScreen'
import { ConnectScreen } from './screens/ConnectScreen'
import { DropsScreen } from './screens/DropsScreen'

const screens = {
  feed: FeedScreen,
  dms: DmsScreen,
  alerts: AlertsScreen,
  connect: ConnectScreen,
  drops: DropsScreen,
} as const

function App() {
  const [offlineReady, setOfflineReady] = useState(false)
  const activeTab = useUiStore((s) => s.activeTab)
  const loadIdentity = useIdentityStore((s) => s.loadIdentity)

  // Service worker events
  useEffect(() => {
    const handler = () => setOfflineReady(true)
    window.addEventListener('sw-offline-ready', handler)
    window.addEventListener('sw-registered', handler)
    return () => {
      window.removeEventListener('sw-offline-ready', handler)
      window.removeEventListener('sw-registered', handler)
    }
  }, [])

  // Initialize identity and start TTL sweeper
  useEffect(() => {
    loadIdentity()
    const stopSweeper = startTtlSweeper()
    return stopSweeper
  }, [loadIdentity])

  const Screen = screens[activeTab]

  return (
    <Layout>
      <div key={activeTab} className="animate-fade-in">
        <Screen />
      </div>

      <ComposeModal />
      <MessageDetailModal />

      {offlineReady && (
        <div className="fixed bottom-20 right-4 z-30 bg-green-600 text-white text-sm px-3 py-1.5 rounded-md shadow-lg animate-pulse">
          Offline ready
        </div>
      )}
    </Layout>
  )
}

export default App
