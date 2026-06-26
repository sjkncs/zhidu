'use client';

import { FileText } from 'lucide-react';
import ResumeBuilder from '@/components/resume/ResumeBuilder';

export default function ResumePage() {
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-navy/10">
          <FileText className="h-5 w-5 text-navy" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-text-primary">简历</h1>
          <p className="text-sm text-text-secondary">
            AI 辅助生成专业简历，支持智能填充与在线预览
          </p>
        </div>
      </div>
      <ResumeBuilder />
    </div>
  );
}
