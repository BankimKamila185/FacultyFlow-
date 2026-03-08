import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { AuthProvider } from './context/AuthContext'

// Prevent PWA Service Worker in Electron (it fails on file://)
if (window.process && window.process.type === 'renderer' || navigator.userAgent.includes('Electron')) {
  window.addEventListener('load', () => {
    const swScript = document.getElementById('vite-plugin-pwa:register-sw');
    if (swScript) swScript.remove();
  });
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>,
)
