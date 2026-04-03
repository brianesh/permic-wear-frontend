import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

async function initApp() {
  // Unregister ALL existing service workers first (clears stuck/broken ones)
  if ('serviceWorker' in navigator) {
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(regs.map((r) => r.unregister()));

    // Clear ALL caches — removes any cached 401s or corrupt responses
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
  }

  // Keep Render backend alive — ping /health every 4 minutes
  if (import.meta.env.PROD) {
    const raw = import.meta.env.VITE_API_URL || '';
    const BACKEND = raw.replace(/\/api\/?$/, '').replace(/\/+$/, '');
    if (BACKEND) {
      const ping = () => fetch(`${BACKEND}/health`, { method: 'GET' }).catch(() => {});
      ping();
      setInterval(ping, 4 * 60 * 1000);
    }
  }

  // Render the app
  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );

  // Re-register the fresh service worker AFTER app renders
  if (import.meta.env.PROD && 'serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    });
  }
}

initApp();
