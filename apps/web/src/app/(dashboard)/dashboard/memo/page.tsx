'use client';

import { useState, useCallback } from 'react';
import { StickyNote } from 'lucide-react';
import MemoBoard from '@/components/memo/MemoBoard';

export default function MemoPage() {
  const [refreshKey, setRefreshKey] = useState(0);

  const handleMemoCreated = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10">
          <StickyNote className="h-5 w-5 text-amber-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-text-primary">备忘录</h1>
          <p className="text-sm text-text-secondary">
            快速记录灵感与待办，标签分类管理，置顶与归档
          </p>
        </div>
      </div>

      {/* Memo Board */}
      <MemoBoard
        key={refreshKey}
        onMemoCreated={handleMemoCreated}
      />
    </div>
  );
}
