'use client';

import { Briefcase } from 'lucide-react';
import InternshipManager from '@/components/internship/InternshipManager';

export default function InternshipPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-navy/10">
          <Briefcase className="h-5 w-5 text-navy" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-text-primary">实习</h1>
          <p className="text-sm text-text-secondary">
            管理实习经历，积累实践经验，AI 智能匹配机会
          </p>
        </div>
      </div>
      <InternshipManager />
    </div>
  );
}
