import { useState, useEffect } from 'react'
import { startTtlSweeper } from './db'
import { useIdentityStore } from './store/identity'
import { useUiStore } from './store/ui'
import { Layout } from './components/Layout'
import { ComposeModal } from './components/ComposeModal'
import { MessageDetailModal } from './components/MessageDetailModal'
import { ToastContainer } from './components/ToastContainer'
import { PanicWipeModal } from './components/PanicWipeModal'
import { FirstRun } from './components/FirstRun'
import { MeshGraph } from './screens/MeshGraph'
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
  const [meshOpen, setMeshOpen] = useState(false)
  const activeTab = useUiStore((s) => s.activeTab)
  const loadIdentity = useIdentityStore((s) => s.loadIdentity)

  useEffect(() => {
    const handler = () => setOfflineReady(true)
    const meshHandler = () => setMeshOpen(true)
    window.addEventListener('sw-offline-ready', handler)
    window.addEventListener('sw-registered', handler)
    window.addEventListener('open-mesh-graph', meshHandler)
    return () => {
      window.removeEventListener('sw-offline-ready', handler)
      window.removeEventListener('sw-registered', handler)
      window.removeEventListener('open-mesh-graph', meshHandler)
    }
  }, [])

  useEffect(() => {
    loadIdentity()
    const stopSweeper = startTtlSweeper()

    if (import.meta.env.DEV) {
      import('./sync/__tests__').then((t) => t.runSyncTests())
    }

    return stopSweeper
  }, [loadIdentity])

  const Screen = screens[activeTab]

  return (
    <Layout onMeshOpen={() => setMeshOpen(true)}>
      <div key={activeTab} className="animate-fade-in">
        <Screen />
      </div>

      <ComposeModal />
      <MessageDetailModal />
      <ToastContainer />

      <FirstRun />
      <PanicWipeModal />
      {meshOpen && <MeshGraph onClose={() => setMeshOpen(false)} />}

      {offlineReady && (
        <div className="fixed bottom-20 right-4 z-30 bg-green-600 text-white text-sm px-3 py-1.5 rounded-md shadow-lg animate-pulse">
          Offline ready
        </div>
      )}
    </Layout>
  )
}

export default App
