'use client';

import { useState, useCallback } from 'react';
import { Compass, Target, BookOpen, Map } from 'lucide-react';
import CareerExplorer from '@/components/career/CareerExplorer';
import GoalManager from '@/components/career/GoalManager';
import PlanningTemplates from '@/components/career/PlanningTemplates';

type TabKey = 'explore' | 'goals' | 'templates';

interface Tab {
  key: TabKey;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const tabs: Tab[] = [
  { key: 'explore', label: '职业探索', icon: Compass },
  { key: 'goals', label: '目标管理', icon: Target },
  { key: 'templates', label: '规划模板', icon: BookOpen },
];

export default function CareerPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('explore');
  const [goalRefreshKey, setGoalRefreshKey] = useState(0);

  const handleGoalsCreated = useCallback(() => {
    setGoalRefreshKey((k) => k + 1);
    setActiveTab('goals');
  }, []);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-navy/10">
          <Map className="h-5 w-5 text-navy" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-text-primary">生涯规划</h1>
          <p className="text-sm text-text-secondary">
            探索职业方向，分解目标，制定个人成长路线图
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
              className={[
                'flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-blue text-white shadow-sm'
                  : 'text-text-secondary hover:bg-surface-elevated hover:text-text-primary',
              ].join(' ')}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div>
        {activeTab === 'explore' && (
          <CareerExplorer onGoalsCreated={handleGoalsCreated} />
        )}
        {activeTab === 'goals' && (
          <GoalManager refreshKey={goalRefreshKey} />
        )}
        {activeTab === 'templates' && (
          <PlanningTemplates onTemplateApplied={handleGoalsCreated} />
        )}
      </div>
    </div>
  );
}
