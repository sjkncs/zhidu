'use client';

import { Satellite } from 'lucide-react';
import PapersRadar from '@/components/papers/PapersRadar';

export default function PapersPage() {
  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet/10">
          <Satellite className="h-5 w-5 text-violet" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-text-primary">学术雷达</h1>
          <p className="text-sm text-text-secondary">
            AI/ML/量化金融前沿论文追踪 · AI 增强摘要 · 投资&科研交叉洞察
          </p>
        </div>
      </div>
      <PapersRadar />
    </div>
  );
}
