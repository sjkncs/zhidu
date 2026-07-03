import { create } from 'zustand';
import { parseSSEStream, type Source } from '@/lib/sse-parser';
import type { ChatMode } from '@/components/chat/ChatInput';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: Source[];
  createdAt: number;
  isStreaming?: boolean;
}

export interface ChatSession {
  id: string;
  title: string;
  taskType: string;
  messageCount: number;
  lastActiveAt: string;
}

interface ChatState {
  messages: ChatMessage[];
  sessions: ChatSession[];
  currentSessionId: string | null;
  isStreaming: boolean;
  error: string | null;

  sendMessage: (query: string, preferMode?: ChatMode) => Promise<void>;
  clearMessages: () => void;
  clearError: () => void;
  fetchSessions: () => Promise<void>;
  loadSession: (sessionId: string) => Promise<void>;
  createNewSession: () => void;
  deleteSession: (sessionId: string) => Promise<void>;
}

function generateId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  sessions: [],
  currentSessionId: null,
  isStreaming: false,
  error: null,

  fetchSessions: async () => {
    try {
      const res = await fetch('/api/ai/chat/sessions');
      if (res.ok) {
        const json = await res.json();
        set({ sessions: json.data ?? [] });
      }
    } catch {
      // silently fail
    }
  },

  loadSession: async (sessionId: string) => {
    try {
      const res = await fetch(`/api/ai/chat/sessions/${sessionId}`);
      if (res.ok) {
        const json = await res.json();
        const messages: ChatMessage[] = (json.data ?? []).map((m: any) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          sources: m.sources ?? [],
          createdAt: new Date(m.createdAt).getTime(),
          isStreaming: false,
        }));
        set({ messages, currentSessionId: sessionId, error: null });
      }
    } catch {
      // silently fail
    }
  },

  createNewSession: () => {
    set({ messages: [], currentSessionId: null, error: null });
  },

  deleteSession: async (sessionId: string) => {
    try {
      const res = await fetch(`/api/ai/chat/sessions/${sessionId}`, { method: 'DELETE' });
      if (res.ok) {
        const state = get();
        set({
          sessions: state.sessions.filter((s) => s.id !== sessionId),
          ...(state.currentSessionId === sessionId
            ? { messages: [], currentSessionId: null }
            : {}),
        });
      }
    } catch {
      // silently fail
    }
  },

  sendMessage: async (query: string, preferMode?: ChatMode) => {
    const trimmed = query.trim();
    if (!trimmed || get().isStreaming) return;

    // 添加用户消息
    const userMsg: ChatMessage = {
      id: generateId(),
      role: 'user',
      content: trimmed,
      createdAt: Date.now(),
    };

    // 创建 assistant 占位消息
    const assistantId = generateId();
    const assistantMsg: ChatMessage = {
      id: assistantId,
      role: 'assistant',
      content: '',
      createdAt: Date.now(),
      isStreaming: true,
    };

    set((state) => ({
      messages: [...state.messages, userMsg, assistantMsg],
      isStreaming: true,
      error: null,
    }));

    // 构建上下文：最近 6 条历史消息（3 轮对话）
    const allMessages = get().messages;
    const context = allMessages
      .filter((m) => !m.isStreaming)
      .slice(-6)
      .map((m) => ({ role: m.role, content: m.content }));

    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: trimmed,
          stream: true,
          context,
          sessionId: get().currentSessionId,
          preferMode,
        }),
      });

      if (!response.ok) {
        const errBody = await response.json().catch(() => ({}));
        throw new Error(
          (errBody as Record<string, string>).error ?? `请求失败 (${response.status})`,
        );
      }

      if (!response.body) {
        throw new Error('响应流不可用');
      }

      const reader = response.body.getReader();
      let timeoutId: ReturnType<typeof setTimeout> | null = null;

      // 30 秒无新数据超时
      const resetTimeout = () => {
        if (timeoutId) clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
          reader.cancel().catch(() => {});
          set((state) => ({
            isStreaming: false,
            error: '响应超时，请重试',
            messages: state.messages.map((m) =>
              m.id === assistantId ? { ...m, isStreaming: false } : m,
            ),
          }));
        }, 30000);
      };

      resetTimeout();

      for await (const event of parseSSEStream(reader)) {
        resetTimeout();

        switch (event.type) {
          case 'session':
            set({ currentSessionId: event.sessionId });
            break;

          case 'sources':
            set((state) => ({
              messages: state.messages.map((m) =>
                m.id === assistantId ? { ...m, sources: event.sources } : m,
              ),
            }));
            break;

          case 'content':
            set((state) => ({
              messages: state.messages.map((m) =>
                m.id === assistantId
                  ? { ...m, content: m.content + event.delta }
                  : m,
              ),
            }));
            break;

          case 'error':
            set((state) => ({
              error: event.error,
              isStreaming: false,
              messages: state.messages.map((m) =>
                m.id === assistantId ? { ...m, isStreaming: false } : m,
              ),
            }));
            break;

          case 'done':
            break;
        }

        if (event.type === 'error') break;
      }

      if (timeoutId) clearTimeout(timeoutId);

      // 标记流结束
      set((state) => ({
        isStreaming: false,
        messages: state.messages.map((m) =>
          m.id === assistantId ? { ...m, isStreaming: false } : m,
        ),
      }));

      // Refresh sessions list
      get().fetchSessions();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : '未知错误，请稍后重试';

      set((state) => ({
        isStreaming: false,
        error: message,
        messages: state.messages.map((m) =>
          m.id === assistantId
            ? {
                ...m,
                isStreaming: false,
                content: m.content || '抱歉，生成回答时出现了错误。',
              }
            : m,
        ),
      }));
    }
  },

  clearMessages: () => {
    set({ messages: [], currentSessionId: null, error: null });
  },

  clearError: () => {
    set({ error: null });
  },
}));
