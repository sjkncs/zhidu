'use client';

import { useState, useCallback } from 'react';
import { BookMarked } from 'lucide-react';
import DiaryWriter from '@/components/diary/DiaryWriter';

export default function DiaryPage() {
  const [refreshKey, setRefreshKey] = useState(0);

  const handleEntryCreated = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10">
          <BookMarked className="h-5 w-5 text-emerald-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-text-primary">日记</h1>
          <p className="text-sm text-text-secondary">
            记录每日成长与心情，情绪趋势追踪，AI 成长洞察
          </p>
        </div>
      </div>

      {/* Diary Writer */}
      <DiaryWriter
        key={refreshKey}
        onEntryCreated={handleEntryCreated}
      />
    </div>
  );
}
