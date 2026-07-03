'use client';

import { useState, useCallback } from 'react';
import { Clock } from 'lucide-react';
import TimeManager from '@/components/time/TimeManager';

type TabKey = 'manager';

interface Tab {
  key: TabKey;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const tabs: Tab[] = [
  { key: 'manager', label: '时间管理', icon: Clock },
];

export default function TimePage() {
  const [activeTab, setActiveTab] = useState<TabKey>('manager');
  const [refreshKey, setRefreshKey] = useState(0);

  const handleReviewGenerated = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue/10">
          <Clock className="h-5 w-5 text-blue" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-text-primary">时间管理</h1>
          <p className="text-sm text-text-secondary">
            待办清单、番茄钟专注、日程规划，AI 智能周回顾
          </p>
        </div>
      </div>

      {/* Tab navigation */}
      <div className="flex gap-1 rounded-xl border border-border bg-surface p-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all ${
                isActive
                  ? 'bg-blue text-white shadow-sm'
                  : 'text-text-secondary hover:bg-surface-elevated hover:text-text-primary'
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      {activeTab === 'manager' && (
        <TimeManager
          key={refreshKey}
          onReviewGenerated={handleReviewGenerated}
        />
      )}
    </div>
  );
}
