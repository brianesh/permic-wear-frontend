/**
 * keepalive.js — Prevents Render.com free tier from sleeping
 *
 * Pings the /ping endpoint every 4 minutes to keep the server warm.
 * Uses the ROOT_URL (without /api suffix) from the API config.
 *
 * Usage:
 *   import { startKeepalive, stopKeepalive } from './lib/keepalive';
 *   useEffect(() => { startKeepalive(); return () => stopKeepalive(); }, []);
 */

import { ROOT_URL } from '../services/api';

const INTERVAL_MS = 4 * 60 * 1000; // 4 minutes
let intervalId = null;
let pingInProgress = false;

async function ping() {
  if (pingInProgress) return;
  pingInProgress = true;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const res = await fetch(`${ROOT_URL}/ping`, {
      method: 'GET',
      signal: controller.signal,
      cache: 'no-cache',
    });
    clearTimeout(timeout);
    if (res.ok) {
      const data = await res.json();
      console.log('[keepalive] ping ok — server time:', new Date(data.t).toLocaleString());
    } else {
      console.warn('[keepalive] ping returned', res.status);
    }
  } catch (err) {
    // Silently fail — don't spam the console on network errors
    if (err.name !== 'AbortError') console.warn('[keepalive] ping failed:', err.message);
  } finally {
    pingInProgress = false;
  }
}

export function startKeepalive() {
  if (intervalId) return; // already running
  console.log('[keepalive] started — pinging every 4 min');
  ping(); // immediate first ping
  intervalId = setInterval(ping, INTERVAL_MS);
}

export function stopKeepalive() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    console.log('[keepalive] stopped');
  }
}