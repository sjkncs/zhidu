'use client';

import { useState, useEffect, useCallback } from 'react';
import { GraduationCap, BookOpen, TrendingUp, BarChart3 } from 'lucide-react';
import CourseManager from '@/components/academic/CourseManager';
import GpaCalculator from '@/components/academic/GpaCalculator';
import AcademicSummaryView from '@/components/academic/AcademicSummary';

type TabKey = 'courses' | 'gpa' | 'summary';

interface Tab {
  key: TabKey;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface Semester {
  id: string;
  userId: string;
  name: string;
  startDate?: string;
  endDate?: string;
  isCurrent: boolean;
}

const tabs: Tab[] = [
  { key: 'courses', label: '课程管理', icon: BookOpen },
  { key: 'gpa', label: 'GPA 计算', icon: TrendingUp },
  { key: 'summary', label: '学业总览', icon: BarChart3 },
];

export default function AcademicPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('courses');
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);

  // Fetch semesters
  useEffect(() => {
    async function fetchSemesters() {
      try {
        const res = await fetch('/api/semesters');
        if (res.ok) {
          const json = await res.json();
          setSemesters(json.data ?? []);
        }
      } catch {
        // silently fail
      }
    }
    fetchSemesters();
  }, [refreshKey]);

  const handleSemesterCreated = useCallback((s: Semester) => {
    setSemesters((prev) => [s, ...prev]);
  }, []);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-navy/10">
          <GraduationCap className="h-5 w-5 text-navy" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-text-primary">学业管理</h1>
          <p className="text-sm text-text-secondary">
            课程成绩追踪、GPA 计算与学业进度管理
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
        {activeTab === 'courses' && (
          <CourseManager
            key={refreshKey}
            semesters={semesters}
            onSemesterCreated={handleSemesterCreated}
          />
        )}
        {activeTab === 'gpa' && (
          <GpaCalculator key={`gpa-${refreshKey}`} />
        )}
        {activeTab === 'summary' && (
          <AcademicSummaryView key={`summary-${refreshKey}`} />
        )}
      </div>
    </div>
  );
}
