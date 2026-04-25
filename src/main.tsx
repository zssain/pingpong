import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Register service worker for offline support
import { registerSW } from 'virtual:pwa-register'

registerSW({
  onRegisteredSW(_swUrl, registration) {
    if (registration) {
      console.log('[SW] Service worker registered')
      window.dispatchEvent(new Event('sw-registered'))
    }
  },
  onOfflineReady() {
    console.log('[SW] App ready to work offline')
    window.dispatchEvent(new Event('sw-offline-ready'))
  },
})
