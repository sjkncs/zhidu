'use client';

import { useChatStore } from '@/stores/chat-store';
import { ArrowRight, GraduationCap, Briefcase, BookOpen, Target } from 'lucide-react';

const suggestions = [
  { text: '985 和 211 有什么区别？', icon: GraduationCap, color: 'text-blue' },
  { text: '计算机专业的就业前景如何？', icon: Briefcase, color: 'text-emerald-500' },
  { text: '如何科学填报平行志愿？', icon: BookOpen, color: 'text-amber-500' },
  { text: '什么专业适合理科生？', icon: Target, color: 'text-purple-500' },
];

export function ChatWelcome() {
  const sendMessage = useChatStore((s) => s.sendMessage);

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-12">
      {/* Logo */}
      <div className="relative mb-8">
        <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-blue to-blue/70 text-3xl font-bold text-white shadow-lg shadow-blue/20">
          知
        </div>
        <div className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-emerald-400 shadow-sm ring-2 ring-surface">
          <svg className="h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
      </div>

      <h2 className="mb-3 text-2xl font-bold tracking-tight text-text-primary">
        你好，我是知渡 AI 助手
      </h2>
      <p className="mb-10 max-w-md text-center text-[15px] leading-relaxed text-text-secondary">
        基于知识库的智能问答，帮你解答志愿填报、专业选择、职业规划等问题
      </p>

      {/* 建议问题卡片 */}
      <div className="grid w-full max-w-xl gap-2.5 sm:grid-cols-2">
        {suggestions.map((s) => (
          <button
            key={s.text}
            onClick={() => sendMessage(s.text)}
            className="group flex items-center gap-3 rounded-2xl border border-border/60 bg-surface/50 px-5 py-4 text-left text-sm text-text-secondary backdrop-blur-sm transition-all duration-200 hover:border-blue/30 hover:bg-background hover:text-text-primary hover:shadow-sm"
          >
            <div className={['flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-surface-elevated transition-colors group-hover:bg-blue/10', s.color].join(' ')}>
              <s.icon className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <span className="block truncate text-[13px] font-medium leading-snug">{s.text}</span>
            </div>
            <ArrowRight className="h-3.5 w-3.5 shrink-0 text-text-tertiary/50 transition-all group-hover:translate-x-0.5 group-hover:text-blue" />
          </button>
        ))}
      </div>
    </div>
  );
}
