'use client';

import { useState, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { X, Save, ExternalLink, Pencil } from 'lucide-react';
import type { ChatMessage } from '@/stores/chat-store';

interface EditPanelProps {
  /** 当前正在编辑的消息 */
  message: ChatMessage;
  /** 保存回调，将编辑后的内容传回 */
  onSave: (messageId: string, newContent: string) => void;
  /** 关闭面板回调 */
  onClose: () => void;
}

/**
 * 编辑面板组件
 * 从右侧滑入，用于编辑 AI 回复的 Markdown 内容
 * 包含实时预览、WPS 在线编辑和保存功能
 */
export function EditPanel({ message, onSave, onClose }: EditPanelProps) {
  // 编辑区内容，初始值为消息原始内容
  const [content, setContent] = useState(message.content);
  // 是否已滑入完成
  const [isVisible, setIsVisible] = useState(false);
  // WPS 按钮加载状态
  const [isOpeningWps, setIsOpeningWps] = useState(false);
  // 保存按钮加载状态
  const [isSaving, setIsSaving] = useState(false);

  // 组件挂载后触发滑入动画
  useEffect(() => {
    const timer = requestAnimationFrame(() => setIsVisible(true));
    return () => cancelAnimationFrame(timer);
  }, []);

  // 消息切换时重置编辑内容
  useEffect(() => {
    setContent(message.content);
  }, [message.id, message.content]);

  /**
   * 在 WPS 中打开
   * 将 Markdown 转为 HTML 后上传至 Supabase Storage，
   * 生成签名 URL 后跳转至 WPS 在线编辑（WPS 不支持 .md 格式）
   */
  const handleOpenInWps = useCallback(async () => {
    if (isOpeningWps) return;
    setIsOpeningWps(true);

    try {
      // Convert Markdown to a simple HTML document that WPS can open
      const htmlContent = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<title>编辑内容</title>
<style>
  body { font-family: 'Microsoft YaHei', 'PingFang SC', sans-serif; max-width: 800px; margin: 40px auto; padding: 0 20px; line-height: 1.8; color: #333; }
  h1, h2, h3 { color: #1a1a1a; }
  code { background: #f5f5f5; padding: 2px 6px; border-radius: 3px; font-size: 0.9em; }
  pre { background: #f5f5f5; padding: 16px; border-radius: 6px; overflow-x: auto; }
  blockquote { border-left: 3px solid #ddd; margin-left: 0; padding-left: 16px; color: #666; }
  table { border-collapse: collapse; width: 100%; }
  th, td { border: 1px solid #ddd; padding: 8px 12px; text-align: left; }
  th { background: #f5f5f5; }
</style>
</head>
<body>
${content
  .replace(/^### (.*$)/gm, '<h3>$1</h3>')
  .replace(/^## (.*$)/gm, '<h2>$1</h2>')
  .replace(/^# (.*$)/gm, '<h1>$1</h1>')
  .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
  .replace(/\*(.*?)\*/g, '<em>$1</em>')
  .replace(/`(.*?)`/g, '<code>$1</code>')
  .replace(/^\> (.*$)/gm, '<blockquote>$1</blockquote>')
  .replace(/^\- (.*$)/gm, '<li>$1</li>')
  .replace(/^\d+\. (.*$)/gm, '<li>$1</li>')
  .replace(/\n\n/g, '</p><p>')
  .replace(/\n/g, '<br>')}
</body>
</html>`;

      const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
      const file = new File([blob], `edit-${message.id}-${Date.now()}.html`, {
        type: 'text/html',
      });

      const formData = new FormData();
      formData.append('file', file);
      formData.append('bucket', 'temp-edits');

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `上传失败 (${response.status})`);
      }

      const data = await response.json();

      // 拼接 WPS 在线编辑地址并打开
      const wpsUrl = `https://kdocs.cn/l/new?file=${encodeURIComponent(data.url)}`;
      window.open(wpsUrl, '_blank', 'noopener,noreferrer');
    } catch (err) {
      const msg = err instanceof Error ? err.message : '操作失败，请重试';
      alert(`在 WPS 中打开失败: ${msg}`);
    } finally {
      setIsOpeningWps(false);
    }
  }, [content, message.id, isOpeningWps]);

  /**
   * 保存编辑内容
   */
  const handleSave = useCallback(async () => {
    if (isSaving) return;
    setIsSaving(true);

    try {
      onSave(message.id, content);
    } finally {
      setIsSaving(false);
    }
  }, [content, message.id, onSave, isSaving]);

  return (
    <>
      {/* 背景遮罩 */}
      <div
        className={[
          'fixed inset-0 z-40 bg-black/30 transition-opacity duration-300',
          isVisible ? 'opacity-100' : 'opacity-0',
        ].join(' ')}
        onClick={onClose}
      />

      {/* 右侧滑入面板 */}
      <div
        className={[
          'fixed right-0 top-0 z-50 flex h-full w-[480px] flex-col',
          'border-l border-border bg-surface shadow-2xl',
          'transition-transform duration-300 ease-out',
          isVisible ? 'translate-x-0' : 'translate-x-full',
        ].join(' ')}
      >
        {/* ── 面板头部 ── */}
        <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
          <div className="flex items-center gap-2">
            <Pencil className="h-4 w-4 text-blue" />
            <span className="text-sm font-semibold text-text-primary">编辑回复</span>
          </div>

          <div className="flex items-center gap-2">
            {/* 在 WPS 中打开 */}
            <button
              onClick={handleOpenInWps}
              disabled={isOpeningWps}
              className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-elevated hover:text-text-primary disabled:opacity-50"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              {isOpeningWps ? '正在打开...' : '在 WPS 中打开'}
            </button>

            {/* 保存按钮 */}
            <button
              onClick={handleSave}
              disabled={isSaving || content === message.content}
              className="flex items-center gap-1.5 rounded-lg bg-blue px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue/90 disabled:opacity-50"
            >
              <Save className="h-3.5 w-3.5" />
              {isSaving ? '保存中...' : '保存'}
            </button>

            {/* 关闭按钮 */}
            <button
              onClick={onClose}
              className="flex h-7 w-7 items-center justify-center rounded-md text-text-tertiary transition-colors hover:bg-surface-elevated hover:text-text-primary"
              title="关闭"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* ── 编辑区（上半部分）── */}
        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="flex items-center justify-between px-5 py-2">
            <span className="text-xs font-medium text-text-tertiary">Markdown 源码</span>
            <span className="text-xs text-text-tertiary/60">{content.length} 字符</span>
          </div>
          <div className="flex-1 overflow-hidden px-5 pb-2">
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              spellCheck={false}
              className="h-full w-full resize-none rounded-lg border border-border bg-surface-elevated p-3.5 font-mono text-[13px] leading-relaxed text-text-primary outline-none transition-colors placeholder:text-text-tertiary/50 focus:border-blue/50 focus:ring-1 focus:ring-blue/20"
              placeholder="在此编辑 Markdown 内容..."
            />
          </div>
        </div>

        {/* ── 预览区（下半部分）── */}
        <div className="flex flex-1 flex-col overflow-hidden border-t border-border">
          <div className="flex items-center px-5 py-2">
            <span className="text-xs font-medium text-text-tertiary">实时预览</span>
          </div>
          <div className="flex-1 overflow-y-auto px-5 pb-4">
            <div className="prose prose-sm max-w-none text-[14px] text-text-primary prose-headings:text-text-primary prose-p:text-text-primary prose-strong:text-text-primary prose-code:rounded prose-code:bg-surface-elevated prose-code:px-1 prose-code:py-0.5 prose-code:text-[12px] prose-code:text-text-primary prose-a:text-blue prose-blockquote:border-blue/30 prose-blockquote:text-text-secondary prose-hr:border-border/50 prose-th:text-text-primary prose-td:text-text-secondary">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {content || '*（暂无内容）*'}
              </ReactMarkdown>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
