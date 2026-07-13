import { create } from 'zustand';
import { parseSSEStream, type Source, type ChoicePromptData, type TaskUpdateData } from '@/lib/sse-parser';
import type { ChatMode } from '@/components/chat/ChatInput';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: Source[];
  createdAt: number;
  isStreaming?: boolean;
  /** P1: 结构化选择引导 — AI 向用户展示的选项卡片 */
  choicePrompt?: ChoicePromptData;
  /** P1: 用户对该选择引导的回答（已选选项标签数组） */
  choiceResponse?: string[];
  /** P1: 用户是否已回答该选择引导 */
  choiceAnswered?: boolean;
  /** P3: 多步骤任务进度追踪 */
  tasks?: TaskUpdateData[];
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

  sendMessage: (query: string, preferMode?: ChatMode, choiceResponse?: string[]) => Promise<void>;
  /** P1: 用户对结构化选择引导的回答，自动触发下一轮对话 */
  sendChoiceResponse: (messageId: string, selectedLabels: string[]) => Promise<void>;
  clearMessages: () => void;
  clearError: () => void;
  fetchSessions: () => Promise<void>;
  loadSession: (sessionId: string) => Promise<void>;
  createNewSession: () => void;
  deleteSession: (sessionId: string) => Promise<void>;
  /** 更新指定消息的内容（用于编辑回复） */
  updateMessage: (id: string, content: string) => void;
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

  sendMessage: async (query: string, preferMode?: ChatMode, choiceResponse?: string[]) => {
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
          ...(choiceResponse ? { choiceResponse } : {}),
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

      // 60 秒无新数据超时（管线含 IntentClarifier + StructuredQuery + RAG + LLM 流式生成）
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
        }, 60000);
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

          case 'choice_prompt':
            set((state) => ({
              messages: state.messages.map((m) =>
                m.id === assistantId
                  ? { ...m, choicePrompt: event.prompt }
                  : m,
              ),
            }));
            break;

          case 'task_update':
            set((state) => ({
              messages: state.messages.map((m) => {
                if (m.id !== assistantId) return m;
                const existing = m.tasks ?? [];
                const updated = existing.some((t) => t.taskId === event.task.taskId)
                  ? existing.map((t) =>
                      t.taskId === event.task.taskId ? { ...t, ...event.task } : t,
                    )
                  : [...existing, event.task];
                return { ...m, tasks: updated };
              }),
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

  /** P1: 用户回答结构化选择引导 */
  sendChoiceResponse: async (messageId: string, selectedLabels: string[]) => {
    // 标记该消息的选择引导已回答
    set((state) => ({
      messages: state.messages.map((m) =>
        m.id === messageId
          ? { ...m, choiceAnswered: true, choiceResponse: selectedLabels }
          : m,
      ),
    }));

    // 构造选择文本作为下一轮对话的输入
    const choiceText = `已选择: ${selectedLabels.join('、')}`;
    await get().sendMessage(choiceText, undefined, selectedLabels);
  },

  clearMessages: () => {
    set({ messages: [], currentSessionId: null, error: null });
  },

  clearError: () => {
    set({ error: null });
  },

  /** 更新指定消息的内容（乐观更新 + 后台持久化） */
  updateMessage: (id: string, content: string) => {
    // 先更新本地状态
    set((state) => ({
      messages: state.messages.map((m) =>
        m.id === id ? { ...m, content } : m,
      ),
    }));

    // 后台持久化到数据库
    fetch(`/api/ai/chat/messages/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    }).catch((err) => {
      console.warn('[chat-store] Failed to persist message edit:', err);
    });
  },
}));
