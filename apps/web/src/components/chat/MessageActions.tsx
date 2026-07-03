'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Copy,
  Check,
  ThumbsUp,
  ThumbsDown,
  Download,
  Pencil,
} from 'lucide-react';
import type { ChatMessage } from '@/stores/chat-store';

interface MessageActionsProps {
  message: ChatMessage;
  onEdit?: () => void;
}

function Toast({ text, visible }: { text: string; visible: boolean }) {
  return (
    <div
      className={[
        'absolute -top-8 left-1/2 -translate-x-1/2 z-10 pointer-events-none',
        'rounded-full bg-gray-800 px-3 py-1 text-xs text-white whitespace-nowrap',
        'transition-all duration-300 ease-in-out',
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-1',
      ].join(' ')}
    >
      {text}
    </div>
  );
}

function IconButton({
  icon: Icon,
  tooltip,
  onClick,
  active,
}: {
  icon: React.ComponentType<{ className?: string }>;
  tooltip: string;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={tooltip}
      className={[
        'flex h-7 w-7 items-center justify-center rounded-md transition-colors',
        active
          ? 'bg-blue/10 text-blue'
          : 'text-text-tertiary/50 hover:bg-surface-elevated hover:text-text-secondary',
      ].join(' ')}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}

export function MessageActions({ message, onEdit }: MessageActionsProps) {
  const [copied, setCopied] = useState(false);
  const [feedback, setFeedback] = useState<'up' | 'down' | null>(null);
  const [toast, setToast] = useState<{ text: string; visible: boolean }>({
    text: '',
    visible: false,
  });

  const showToast = useCallback((text: string) => {
    setToast({ text, visible: true });
  }, []);

  useEffect(() => {
    if (!toast.visible) return;
    const timer = setTimeout(() => {
      setToast((prev) => ({ ...prev, visible: false }));
    }, 2000);
    return () => clearTimeout(timer);
  }, [toast.visible, toast.text]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      showToast('已复制到剪贴板');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const textarea = document.createElement('textarea');
      textarea.value = message.content;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      showToast('已复制到剪贴板');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleExport = () => {
    showToast('正在导出...');
    const blob = new Blob([message.content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `zhidu-answer-${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(url);
    setTimeout(() => {
      showToast('导出完成');
    }, 500);
  };

  const handleFeedback = async (type: 'up' | 'down') => {
    const newFeedback = feedback === type ? null : type;
    setFeedback(newFeedback);
    if (newFeedback === 'up') {
      showToast('感谢反馈！');
    } else if (newFeedback === 'down') {
      showToast('感谢反馈，我们会继续改进');
    }
    try {
      await fetch(`/api/ai/chat/messages/${message.id}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feedback: newFeedback }),
      });
    } catch {
      // Silently fail — feedback is non-critical
    }
  };

  return (
    <div className="relative mt-1.5 border-t border-border/30 pt-2">
      <Toast text={toast.text} visible={toast.visible} />
      <div className="flex items-center gap-1">
        <span className="text-[10px] text-text-tertiary/40 mr-1 select-none">操作</span>
        <IconButton
          icon={copied ? Check : Copy}
          tooltip={copied ? '已复制' : '复制 Markdown'}
          onClick={handleCopy}
          active={copied}
        />
        <IconButton
          icon={ThumbsUp}
          tooltip="有帮助"
          onClick={() => handleFeedback('up')}
          active={feedback === 'up'}
        />
        <IconButton
          icon={ThumbsDown}
          tooltip="没帮助"
          onClick={() => handleFeedback('down')}
          active={feedback === 'down'}
        />
        <IconButton
          icon={Download}
          tooltip="导出 .md"
          onClick={handleExport}
        />
        {onEdit && (
          <IconButton
            icon={Pencil}
            tooltip="编辑"
            onClick={onEdit}
          />
        )}
      </div>
    </div>
  );
}
