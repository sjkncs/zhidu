'use client';

import { useState, useEffect, useCallback } from 'react';

export function UpdateNotification() {
  const [showUpdate, setShowUpdate] = useState(false);

  useEffect(() => {
    const handler = () => setShowUpdate(true);
    window.addEventListener('sw-update-available', handler);
    return () => window.removeEventListener('sw-update-available', handler);
  }, []);

  const handleUpdate = useCallback(() => {
    // Tell the waiting SW to activate immediately
    if (navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage('SKIP_WAITING');
    }
    setShowUpdate(false);
  }, []);

  if (!showUpdate) return null;

  return (
    <div className="fixed top-4 left-1/2 z-50 -translate-x-1/2 rounded-lg border border-[var(--color-blue)]/30 bg-[var(--color-blue)]/10 px-4 py-2 backdrop-blur-sm animate-in fade-in slide-in-from-top-2">
      <div className="flex items-center gap-3">
        <span className="text-sm text-[var(--foreground)]">
          知渡有新版本可用
        </span>
        <button
          onClick={handleUpdate}
          className="rounded-md bg-[var(--color-blue)] px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-[var(--color-navy)]"
        >
          立即更新
        </button>
      </div>
    </div>
  );
}
