import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

if (import.meta.env.DEV && 'serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((regs) => regs.forEach((r) => r.unregister()))
}

// Keep Render backend alive — ping /health every 4 minutes so it never cold-starts
if (import.meta.env.PROD) {
  const BACKEND = import.meta.env.VITE_API_URL?.replace('/api', '') || '';
  if (BACKEND) {
    const ping = () => fetch(`${BACKEND}/health`, { method: 'GET' }).catch(() => {});
    ping(); // immediate ping on load to wake backend before user tries to log in
    setInterval(ping, 4 * 60 * 1000);
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  })
}