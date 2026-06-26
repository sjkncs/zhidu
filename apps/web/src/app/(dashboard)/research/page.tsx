'use client';

import { Microscope } from 'lucide-react';
import ResearchManager from '@/components/research/ResearchManager';

export default function ResearchPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-navy/10">
          <Microscope className="h-5 w-5 text-navy" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-text-primary">科研</h1>
          <p className="text-sm text-text-secondary">
            管理科研项目，追踪学术进展，提升研究能力
          </p>
        </div>
      </div>
      <ResearchManager />
    </div>
  );
}
