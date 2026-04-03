import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";

export default function SyncBanner({ isOnline, pendingSync }) {
  const { syncing } = useAuth();
  const [showBack, setShowBack]   = useState(false);
  const [prevOnline, setPrevOnline] = useState(isOnline);

  useEffect(() => {
    if (!prevOnline && isOnline) {
      setShowBack(true);
      // Hide the "back online" toast after sync finishes (or 6s max)
      const t = setTimeout(() => setShowBack(false), 6000);
      return () => clearTimeout(t);
    }
    if (isOnline && pendingSync === 0 && showBack) {
      const t = setTimeout(() => setShowBack(false), 2000);
      return () => clearTimeout(t);
    }
    setPrevOnline(isOnline);
  }, [isOnline, pendingSync]);

  // Nothing to show
  if (isOnline && !showBack && pendingSync === 0 && !syncing) return null;

  // Currently offline
  if (!isOnline) return (
    <div className="sync-banner sync-banner--offline">
      <span className="sync-banner-dot"/>
      <span>
        📴 Offline mode — POS, Cash &amp; Split sales still work normally
        {pendingSync > 0 && `. ${pendingSync} sale${pendingSync > 1 ? "s" : ""} queued`}
      </span>
      {pendingSync > 0 && <span className="sync-banner-badge">{pendingSync} pending</span>}
    </div>
  );

  // Back online + currently syncing
  if (syncing) return (
    <div className="sync-banner sync-banner--syncing">
      <span className="sync-banner-dot sync-banner-dot--amber sync-banner-dot--pulse"/>
      <span>⟳ Syncing {pendingSync} offline sale{pendingSync > 1 ? "s" : ""} to server…</span>
    </div>
  );

  // Just came back online, sync complete
  if (showBack) return (
    <div className="sync-banner sync-banner--back">
      <span className="sync-banner-dot sync-banner-dot--green"/>
      <span>✓ Back online{pendingSync === 0 ? " — all sales synced" : ` — ${pendingSync} pending`}</span>
    </div>
  );

  // Still has pending (edge case — online but sync failed for some)
  if (pendingSync > 0) return (
    <div className="sync-banner sync-banner--pending">
      <span className="sync-banner-dot sync-banner-dot--amber"/>
      <span>{pendingSync} offline sale{pendingSync > 1 ? "s" : ""} waiting to sync</span>
    </div>
  );

  return null;
}
