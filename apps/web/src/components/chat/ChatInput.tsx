'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { ArrowUp, Loader2, Paperclip, Mic, MicOff, Zap, BookOpen, MessageCircle, X, FileText, Image as ImageIcon } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export type ChatMode = 'auto' | 'knowledge' | 'freechat';

const MODE_CONFIG: Record<ChatMode, { label: string; icon: React.ComponentType<{ className?: string }>; description: string }> = {
  auto: { label: '自动路由', icon: Zap, description: 'AI 自动判断走知识库还是直接对话' },
  knowledge: { label: '知识库优先', icon: BookOpen, description: '优先检索知识库参考资料' },
  freechat: { label: '自由对话', icon: MessageCircle, description: '跳过知识库，直接与 LLM 对话' },
};

const MODE_ORDER: ChatMode[] = ['auto', 'knowledge', 'freechat'];

interface Attachment {
  file: File;
  url?: string;
  uploading: boolean;
  error?: string;
}

interface ChatInputProps {
  onSend: (message: string, preferMode?: ChatMode) => void;
  disabled?: boolean;
  isStreaming?: boolean;
}

// Max file size: 10MB
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ACCEPTED_TYPES = [
  'image/png', 'image/jpeg', 'image/gif', 'image/webp',
  'application/pdf',
  'text/plain', 'text/markdown', 'text/csv',
  '.docx', '.xlsx', '.pptx',
];

export function ChatInput({ onSend, disabled, isStreaming }: ChatInputProps) {
  const [value, setValue] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [mode, setMode] = useState<ChatMode>('auto');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [recognitionSupported, setRecognitionSupported] = useState(true);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);

  const adjustHeight = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const maxHeight = 200;
    el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
  }, []);

  useEffect(() => {
    adjustHeight();
  }, [value, adjustHeight]);

  // Check Web Speech API support
  useEffect(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) setRecognitionSupported(false);
  }, []);

  const cycleMode = () => {
    const idx = MODE_ORDER.indexOf(mode);
    setMode(MODE_ORDER[(idx + 1) % MODE_ORDER.length]);
  };

  // ─── File Upload ──────────────────────────────────────
  const handleFileSelect = useCallback(async (files: FileList | null) => {
    if (!files) return;

    const newAttachments: Attachment[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.size > MAX_FILE_SIZE) {
        newAttachments.push({ file, uploading: false, error: '文件超过 10MB 限制' });
        continue;
      }
      newAttachments.push({ file, uploading: true });
    }

    setAttachments((prev) => [...prev, ...newAttachments]);

    // Upload each file to Supabase Storage
    const supabase = createClient();
    for (let i = 0; i < newAttachments.length; i++) {
      const att = newAttachments[i];
      if (att.error) continue;

      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('未登录');

        const ext = att.file.name.split('.').pop() || 'bin';
        const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from('chat-attachments')
          .upload(path, att.file);

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from('chat-attachments')
          .getPublicUrl(path);

        setAttachments((prev) =>
          prev.map((a, idx) =>
            idx === attachments.length + i
              ? { ...a, uploading: false, url: urlData.publicUrl }
              : a
          )
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : '上传失败';
        setAttachments((prev) =>
          prev.map((a, idx) =>
            idx === attachments.length + i
              ? { ...a, uploading: false, error: msg }
              : a
          )
        );
      }
    }
  }, [attachments.length]);

  const removeAttachment = useCallback((index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const getFileIcon = (file: File) => {
    if (file.type.startsWith('image/')) return <ImageIcon className="h-4 w-4 text-blue" />;
    return <FileText className="h-4 w-4 text-text-secondary" />;
  };

  // ─── Voice Input ──────────────────────────────────────
  const toggleRecording = useCallback(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      alert('当前浏览器不支持语音输入，请使用 Chrome 或 Edge');
      return;
    }

    if (isRecording) {
      recognitionRef.current?.stop();
      setIsRecording(false);
      return;
    }

    const recognition = new SR();
    recognition.lang = 'zh-CN';
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (event: any) => {
      let transcript = '';
      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      setValue((prev) => {
        // Replace last interim or append
        const base = prev.replace(/\[语音识别中...\]$/, '').trimEnd();
        return base ? `${base} ${transcript}` : transcript;
      });
    };

    recognition.onerror = (event: any) => {
      if (event.error !== 'aborted') {
        console.warn('[Voice] Recognition error:', event.error);
      }
      setIsRecording(false);
    };

    recognition.onend = () => {
      setIsRecording(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsRecording(true);
  }, [isRecording]);

  // ─── Send ─────────────────────────────────────────────
  const handleSend = () => {
    const trimmed = value.trim();
    if ((!trimmed && attachments.length === 0) || disabled || isStreaming) return;

    // Build message with attachment references
    let message = trimmed;
    const readyAttachments = attachments.filter((a) => a.url);
    if (readyAttachments.length > 0) {
      const attachmentText = readyAttachments
        .map((a) => {
          if (a.file.type.startsWith('image/')) {
            return `![${a.file.name}](${a.url})`;
          }
          return `[${a.file.name}](${a.url})`;
        })
        .join('\n');
      message = message ? `${message}\n\n${attachmentText}` : attachmentText;
    }

    onSend(message, mode);
    setValue('');
    setAttachments([]);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const canSend = (value.trim().length > 0 || attachments.some((a) => a.url)) && !disabled && !isStreaming;
  const hasUploadErrors = attachments.some((a) => a.error);

  return (
    <div className="border-t border-border/50 bg-gradient-to-t from-surface to-surface/80 px-4 py-4 backdrop-blur-sm">
      <div className="mx-auto max-w-3xl">
        {/* 附件预览 */}
        {attachments.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2">
            {attachments.map((att, i) => (
              <div
                key={i}
                className={[
                  'flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs',
                  att.error
                    ? 'border-red-300 bg-red-50 text-red-600'
                    : att.uploading
                    ? 'border-border bg-surface text-text-tertiary'
                    : 'border-border/60 bg-surface text-text-secondary',
                ].join(' ')}
              >
                {att.uploading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  getFileIcon(att.file)
                )}
                <span className="max-w-[140px] truncate">{att.file.name}</span>
                {att.error && <span className="text-red-400">!</span>}
                <button
                  onClick={() => removeAttachment(i)}
                  className="ml-0.5 rounded p-0.5 hover:bg-border/50"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* 输入容器 */}
        <div
          className={[
            'relative flex items-end gap-2 rounded-2xl border bg-background px-4 py-3 shadow-sm transition-all duration-200',
            isFocused
              ? 'border-blue/50 shadow-[0_0_0_3px_rgba(59,130,246,0.08)] ring-1 ring-blue/20'
              : isRecording
              ? 'border-red-400/50 shadow-[0_0_0_3px_rgba(239,68,68,0.08)]'
              : 'border-border/60 hover:border-border',
          ].join(' ')}
        >
          {/* 附件按钮 */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="mb-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-text-tertiary transition-colors hover:bg-surface-elevated hover:text-text-secondary"
            aria-label="添加附件"
            title="上传图片、PDF、文档"
          >
            <Paperclip className="h-4 w-4" />
          </button>

          {/* 隐藏的文件输入 */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={ACCEPTED_TYPES.join(',')}
            className="hidden"
            onChange={(e) => {
              handleFileSelect(e.target.files);
              // Reset so same file can be selected again
              e.target.value = '';
            }}
          />

          {/* 文本输入 */}
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            disabled={disabled || isStreaming}
            placeholder={isRecording ? '正在听你说话...' : '输入你的问题...  @ 可提及更多'}
            rows={1}
            className={[
              'max-h-[200px] min-h-[24px] flex-1 resize-none bg-transparent text-[15px] leading-relaxed text-text-primary',
              'placeholder:text-text-tertiary/70',
              'focus:outline-none',
              'disabled:opacity-50 disabled:cursor-not-allowed',
            ].join(' ')}
          />

          {/* 右侧操作区 */}
          <div className="mb-0.5 flex shrink-0 items-center gap-1">
            {/* 语音按钮 */}
            <button
              type="button"
              onClick={toggleRecording}
              disabled={!recognitionSupported}
              className={[
                'flex h-8 w-8 items-center justify-center rounded-lg transition-colors',
                isRecording
                  ? 'bg-red-100 text-red-500 hover:bg-red-200'
                  : 'text-text-tertiary hover:bg-surface-elevated hover:text-text-secondary',
                !recognitionSupported && 'opacity-30 cursor-not-allowed',
              ].join(' ')}
              aria-label={isRecording ? '停止录音' : '语音输入'}
              title={!recognitionSupported ? '浏览器不支持语音输入' : isRecording ? '点击停止录音' : '点击开始语音输入'}
            >
              {isRecording ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </button>

            {/* 发送按钮 */}
            <button
              onClick={handleSend}
              disabled={!canSend}
              className={[
                'flex h-8 w-8 items-center justify-center rounded-xl transition-all duration-200',
                canSend
                  ? 'bg-blue text-white shadow-sm hover:bg-blue/90 hover:shadow-md active:scale-95'
                  : 'bg-surface-elevated text-text-tertiary/50 cursor-not-allowed',
              ].join(' ')}
              aria-label={isStreaming ? '正在生成...' : '发送'}
            >
              {isStreaming ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ArrowUp className="h-4 w-4" strokeWidth={2.5} />
              )}
            </button>
          </div>
        </div>

        {/* 底部提示 + 模式切换 */}
        <div className="mx-auto mt-2 flex max-w-3xl items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <button
              onClick={cycleMode}
              title={MODE_CONFIG[mode].description}
              className="flex items-center gap-1 rounded-md border border-border/40 px-2 py-0.5 text-[11px] font-medium text-text-secondary transition-colors hover:border-blue/30 hover:bg-blue/[0.04] hover:text-blue"
            >
              {(() => {
                const Icon = MODE_CONFIG[mode].icon;
                return <Icon className="h-3 w-3" />;
              })()}
              {MODE_CONFIG[mode].label}
            </button>
            <p className="text-[11px] text-text-tertiary/60">
              {isRecording ? (
                <span className="text-red-400">录音中... 点击麦克风停止</span>
              ) : (
                'Enter 发送 · Shift+Enter 换行 · AI 回答仅供参考'
              )}
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400/80" />
            <span className="text-[11px] text-text-tertiary/60">知识库已连接</span>
          </div>
        </div>
      </div>
    </div>
  );
}
