import { useState, useEffect } from 'react'
import { startTtlSweeper } from './db'
import { useIdentityStore } from './store/identity'
import { useUiStore } from './store/ui'
import { useMessagesStore } from './store/messages'
import { Layout } from './components/Layout'
import { ComposeModal } from './components/ComposeModal'
import { MessageDetailModal } from './components/MessageDetailModal'
import { ToastContainer } from './components/ToastContainer'
import { PanicWipeModal } from './components/PanicWipeModal'
import { FirstRun } from './components/FirstRun'
import { SplashScreen } from './components/SplashScreen'
import { SettingsFAB } from './components/SettingsFAB'
import { MyHandleModal } from './components/MyHandleModal'
import { AboutModal } from './components/AboutModal'
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
  const [splashDone, setSplashDone] = useState(false)
  const [offlineReady, setOfflineReady] = useState(false)
  const [meshOpen, setMeshOpen] = useState(false)
  const [myHandleOpen, setMyHandleOpen] = useState(false)
  const [aboutOpen, setAboutOpen] = useState(false)
  const activeTab = useUiStore((s) => s.activeTab)
  const loadIdentity = useIdentityStore((s) => s.loadIdentity)
  const markRecentlyArrived = useMessagesStore((s) => s.markRecentlyArrived)

  useEffect(() => {
    const handler = () => setOfflineReady(true)
    const meshHandler = () => setMeshOpen(true)
    const arrivalHandler = (e: Event) => {
      const id = (e as CustomEvent).detail?.id
      if (id) markRecentlyArrived(id)
    }
    window.addEventListener('sw-offline-ready', handler)
    window.addEventListener('sw-registered', handler)
    window.addEventListener('open-mesh-graph', meshHandler)
    window.addEventListener('mesh:message-arrived', arrivalHandler)
    return () => {
      window.removeEventListener('sw-offline-ready', handler)
      window.removeEventListener('sw-registered', handler)
      window.removeEventListener('open-mesh-graph', meshHandler)
      window.removeEventListener('mesh:message-arrived', arrivalHandler)
    }
  }, [markRecentlyArrived])

  useEffect(() => {
    loadIdentity()
    const stopSweeper = startTtlSweeper()
    // Dev sync tests disabled — run manually from console if needed
    // import('./sync/__tests__').then((t) => t.runSyncTests())
    return stopSweeper
  }, [loadIdentity])

  const isReturningUser =
    typeof window !== 'undefined' &&
    localStorage.getItem('firstRunComplete') === '1'

  const splashDuration = isReturningUser ? 1500 : 2400

  if (!splashDone) {
    return <SplashScreen onComplete={() => setSplashDone(true)} durationMs={splashDuration} />
  }

  const Screen = screens[activeTab]

  return (
    <>
      <Layout onMeshOpen={() => setMeshOpen(true)}>
        <div key={activeTab} className="animate-fade-in">
          <Screen />
        </div>

        <ComposeModal />
        <MessageDetailModal />
        <ToastContainer />

        <FirstRun />
        <PanicWipeModal />

        {offlineReady && (
          <div className="fixed bottom-24 right-4 z-30 border border-success bg-surface text-success text-[10px] font-mono uppercase tracking-wider px-3 py-1.5 animate-fade-in">
            OFFLINE READY
          </div>
        )}
      </Layout>

      <SettingsFAB
        onMeshOpen={() => setMeshOpen(true)}
        onMyHandleOpen={() => setMyHandleOpen(true)}
        onAboutOpen={() => setAboutOpen(true)}
      />
      <MyHandleModal isOpen={myHandleOpen} onClose={() => setMyHandleOpen(false)} />
      <AboutModal isOpen={aboutOpen} onClose={() => setAboutOpen(false)} />
      {meshOpen && <MeshGraph onClose={() => setMeshOpen(false)} />}
    </>
  )
}

export default App
