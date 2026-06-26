'use client';

import { useChatStore } from '@/stores/chat-store';
import { MessageSquare, Sparkles } from 'lucide-react';

const suggestions = [
  { text: '985 和 211 有什么区别？', icon: Sparkles },
  { text: '计算机专业的就业前景如何？', icon: Sparkles },
  { text: '如何科学填报平行志愿？', icon: Sparkles },
  { text: '什么专业适合理科生？', icon: Sparkles },
];

export function ChatWelcome() {
  const sendMessage = useChatStore((s) => s.sendMessage);

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-12">
      {/* Avatar */}
      <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-navy text-2xl font-bold text-white">
        知
      </div>

      <h2 className="mb-2 text-xl font-bold text-text-primary">
        你好，我是智渡 AI 助手
      </h2>
      <p className="mb-8 max-w-md text-center text-sm text-text-secondary">
        我可以帮你解答志愿填报、专业选择、职业规划等问题。
        试试下方的建议问题，或直接输入你的疑问。
      </p>

      {/* Suggested questions */}
      <div className="grid w-full max-w-lg gap-3">
        {suggestions.map((s) => (
          <button
            key={s.text}
            onClick={() => sendMessage(s.text)}
            className="group flex items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3 text-left text-sm text-text-secondary transition-all hover:border-blue/40 hover:bg-background hover:text-text-primary"
          >
            <MessageSquare className="h-4 w-4 shrink-0 text-text-tertiary transition-colors group-hover:text-blue" />
            <span>{s.text}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
