'use client';

import { useState, useCallback } from 'react';
import { TreePine, Sparkles, ListTree } from 'lucide-react';
import SkillTreeExplorer from '@/components/skills/SkillTreeExplorer';
import SkillTreeGenerator from '@/components/skills/SkillTreeGenerator';

type TabKey = 'explore' | 'generate';

interface Tab {
  key: TabKey;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const tabs: Tab[] = [
  { key: 'explore', label: '我的技能树', icon: ListTree },
  { key: 'generate', label: '生成 & 模板', icon: Sparkles },
];

export default function SkillsPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('explore');
  const [refreshKey, setRefreshKey] = useState(0);

  const handleTreeCreated = useCallback(() => {
    setRefreshKey((k) => k + 1);
    setActiveTab('explore');
  }, []);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-navy/10">
          <TreePine className="h-5 w-5 text-navy" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-text-primary">技能树</h1>
          <p className="text-sm text-text-secondary">
            可视化技能成长路径，追踪学习进度，AI 智能推荐学习路线
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
      <div key={refreshKey}>
        {activeTab === 'explore' && (
          <SkillTreeExplorer onTreeCreated={handleTreeCreated} />
        )}
        {activeTab === 'generate' && (
          <SkillTreeGenerator onTreeCreated={handleTreeCreated} />
        )}
      </div>
    </div>
  );
}
