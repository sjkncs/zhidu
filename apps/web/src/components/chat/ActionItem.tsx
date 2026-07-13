'use client';

import { useCallback } from 'react';
import {
  GraduationCap,
  BookOpen,
  BarChart3,
  MapPin,
  FileText,
  Play,
  ExternalLink,
} from 'lucide-react';
import { useRouter } from 'next/navigation';

/** 支持的操作类型 */
export type ActionType =
  | 'navigate'       // 导航到内部页面
  | 'open_url'       // 打开外部链接
  | 'send_query'     // 自动发送查询
  | 'compare'        // 对比操作
  | 'generate_plan'  // 生成方案
  | 'custom';        // 自定义操作

export interface ActionItemData {
  /** 操作标签 */
  label: string;
  /** 操作描述 */
  description?: string;
  /** 操作类型 */
  actionType: ActionType;
  /** 操作参数（URL、查询文本等） */
  payload?: string;
  /** 可选图标名称 */
  icon?: string;
  /** 是否已完成 */
  completed?: boolean;
}

interface ActionItemProps {
  item: ActionItemData;
  onAction?: (item: ActionItemData) => void;
  onSendQuery?: (query: string) => void;
}

/** 根据 icon 名称返回对应 lucide 图标组件 */
function getIconComponent(iconName?: string) {
  switch (iconName) {
    case 'graduation':
    case 'university':
      return GraduationCap;
    case 'book':
    case 'major':
      return BookOpen;
    case 'chart':
    case 'analysis':
      return BarChart3;
    case 'location':
    case 'map':
      return MapPin;
    case 'document':
    case 'plan':
      return FileText;
    case 'external':
      return ExternalLink;
    default:
      return Play;
  }
}

/**
 * P2: 交互式操作项组件
 *
 * 在对话消息中渲染可点击的操作卡片，支持多种操作类型：
 * - navigate: 路由到平台内部页面
 * - open_url: 打开外部链接
 * - send_query: 自动发送预设查询
 * - compare: 院校/专业对比
 * - generate_plan: 生成方案
 * - custom: 自定义回调
 */
export function ActionItem({ item, onAction, onSendQuery }: ActionItemProps) {
  const router = useRouter();
  const Icon = getIconComponent(item.icon);

  const handleClick = useCallback(() => {
    if (item.completed) return;

    switch (item.actionType) {
      case 'navigate':
        if (item.payload) router.push(item.payload);
        break;
      case 'open_url':
        if (item.payload) window.open(item.payload, '_blank', 'noopener,noreferrer');
        break;
      case 'send_query':
        if (item.payload && onSendQuery) onSendQuery(item.payload);
        break;
      case 'compare':
        if (item.payload) router.push(`/dashboard/compare?ids=${encodeURIComponent(item.payload)}`);
        break;
      case 'generate_plan':
        if (item.payload && onSendQuery) {
          onSendQuery(`帮我生成${item.payload}的方案`);
        }
        break;
      case 'custom':
        if (onAction) onAction(item);
        break;
    }
  }, [item, router, onAction, onSendQuery]);

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={item.completed}
      className={[
        'group flex w-full items-center gap-3 rounded-lg border px-4 py-3 text-left transition-all duration-150',
        item.completed
          ? 'cursor-default border-border/20 bg-surface/30 opacity-60'
          : 'cursor-pointer border-border/40 bg-surface hover:border-blue/30 hover:bg-blue/[0.04] hover:shadow-sm active:scale-[0.99]',
      ].join(' ')}
    >
      {/* 图标 */}
      <div
        className={[
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors',
          item.completed ? 'bg-border/20' : 'bg-blue/10 group-hover:bg-blue/15',
        ].join(' ')}
      >
        <Icon
          className={[
            'h-4 w-4',
            item.completed ? 'text-text-quaternary' : 'text-blue',
          ].join(' ')}
        />
      </div>

      {/* 文本 */}
      <div className="min-w-0 flex-1">
        <span
          className={[
            'block text-sm font-medium',
            item.completed ? 'text-text-tertiary line-through' : 'text-text-primary',
          ].join(' ')}
        >
          {item.label}
        </span>
        {item.description && (
          <span className="mt-0.5 block truncate text-xs text-text-tertiary">
            {item.description}
          </span>
        )}
      </div>

      {/* 右侧箭头 */}
      {!item.completed && (
        <Play className="h-3.5 w-3.5 shrink-0 text-text-quaternary transition-transform group-hover:translate-x-0.5 group-hover:text-blue" />
      )}
    </button>
  );
}

/**
 * ActionItemGroup: 渲染一组 ActionItem 的容器组件
 */
interface ActionItemGroupProps {
  items: ActionItemData[];
  onAction?: (item: ActionItemData) => void;
  onSendQuery?: (query: string) => void;
  title?: string;
}

export function ActionItemGroup({ items, onAction, onSendQuery, title }: ActionItemGroupProps) {
  if (items.length === 0) return null;

  return (
    <div className="mt-3 space-y-2">
      {title && (
        <p className="text-xs font-medium text-text-tertiary">{title}</p>
      )}
      {items.map((item, i) => (
        <ActionItem
          key={`${item.label}-${i}`}
          item={item}
          onAction={onAction}
          onSendQuery={onSendQuery}
        />
      ))}
    </div>
  );
}
