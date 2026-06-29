'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useChatStore } from '@/stores/chat-store';
import {
  ChatWelcome,
  MessageBubble,
  ChatInput,
  TypingIndicator,
  ChatSessionList,
} from '@/components/chat';
import { Trash2, AlertCircle, X } from 'lucide-react';

export default function ChatPage() {
  const messages = useChatStore((s) => s.messages);
  const isStreaming = useChatStore((s) => s.isStreaming);
  const error = useChatStore((s) => s.error);
  const sendMessage = useChatStore((s) => s.sendMessage);
  const clearMessages = useChatStore((s) => s.clearMessages);
  const clearError = useChatStore((s) => s.clearError);
  const fetchSessions = useChatStore((s) => s.fetchSessions);

  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // 加载历史会话列表
  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  // 自动滚动到底部（仅当用户已在底部附近时）
  const scrollToBottom = useCallback(() => {
    const container = scrollRef.current;
    if (!container) return;

    const isNearBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight < 100;

    if (isNearBottom) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // 检测正在流式输出但还没有内容的 assistant 消息
  const showTypingIndicator =
    isStreaming &&
    messages.length > 0 &&
    messages[messages.length - 1].role === 'assistant' &&
    messages[messages.length - 1].content === '';

  return (
    <div className="flex h-full">
      {/* 左侧：会话历史 */}
      <ChatSessionList />

      {/* 右侧：聊天区域 */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pb-4">
          <div>
            <h1 className="text-xl font-bold text-text-primary">AI 助手</h1>
            <p className="text-sm text-text-secondary">
              基于知识库的智能问答，支持志愿填报、专业咨询、职业规划
            </p>
          </div>
          {messages.length > 0 && (
            <button
              onClick={clearMessages}
              disabled={isStreaming}
              className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-elevated hover:text-text-primary disabled:opacity-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
              清空对话
            </button>
          )}
        </div>

        {/* Error banner */}
        {error && (
          <div className="mx-6 mb-3 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span className="flex-1">{error}</span>
            <button
              onClick={clearError}
              className="shrink-0 rounded p-0.5 hover:bg-red-100"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* Message area */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto px-6"
        >
          {messages.length === 0 ? (
            <ChatWelcome />
          ) : (
            <div className="mx-auto flex max-w-3xl flex-col gap-4 py-6">
              {messages.map((msg) => (
                <MessageBubble key={msg.id} message={msg} />
              ))}

              {showTypingIndicator && <TypingIndicator />}

              <div ref={bottomRef} />
            </div>
          )}
        </div>

        {/* Input */}
        <ChatInput
          onSend={sendMessage}
          isStreaming={isStreaming}
        />
      </div>
    </div>
  );
}
