// @zhidu/ui — 共享 UI 组件库（基于 TailwindCSS）

import React from 'react';

// ─────────────────────────────────────────────────────────────────────────────
// Button 按钮
// ─────────────────────────────────────────────────────────────────────────────

export type ButtonVariant = 'primary' | 'secondary' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** 视觉变体 */
  variant?: ButtonVariant;
  /** 尺寸 */
  size?: ButtonSize;
  /** 是否加载中 */
  loading?: boolean;
  /** 是否占满宽度 */
  fullWidth?: boolean;
  children: React.ReactNode;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-blue text-white hover:bg-blue/90 active:bg-blue/80 focus-visible:ring-blue disabled:bg-blue/40',
  secondary:
    'bg-surface text-text-primary border border-border hover:bg-surface-elevated active:bg-surface-elevated focus-visible:ring-border disabled:bg-surface-elevated disabled:text-text-tertiary',
  ghost:
    'bg-transparent text-text-secondary hover:bg-surface-elevated active:bg-surface-elevated focus-visible:ring-border disabled:text-text-tertiary',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-sm rounded-md gap-1.5',
  md: 'px-4 py-2 text-sm rounded-lg gap-2',
  lg: 'px-6 py-3 text-base rounded-lg gap-2.5',
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', loading = false, fullWidth = false, disabled, className = '', children, ...rest }, ref) => {
    const base =
      'inline-flex items-center justify-center font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed select-none';

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={[
          base,
          variantClasses[variant],
          sizeClasses[size],
          fullWidth ? 'w-full' : '',
          className,
        ].filter(Boolean).join(' ')}
        {...rest}
      >
        {loading && (
          <svg
            className="animate-spin h-4 w-4 shrink-0"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
          </svg>
        )}
        {children}
      </button>
    );
  },
);
Button.displayName = 'Button';

// ─────────────────────────────────────────────────────────────────────────────
// Card 卡片
// ─────────────────────────────────────────────────────────────────────────────

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  /** 去掉内边距（由各子区域自行控制） */
  noPadding?: boolean;
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ noPadding = false, className = '', children, ...rest }, ref) => (
    <div
      ref={ref}
      className={[
        'bg-surface border border-border rounded-xl overflow-hidden',
        noPadding ? '' : 'p-4',
        className,
      ].filter(Boolean).join(' ')}
      {...rest}
    >
      {children}
    </div>
  ),
);
Card.displayName = 'Card';

export interface CardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export const CardHeader = React.forwardRef<HTMLDivElement, CardHeaderProps>(
  ({ className = '', children, ...rest }, ref) => (
    <div
      ref={ref}
      className={['px-4 py-3 border-b border-border', className].filter(Boolean).join(' ')}
      {...rest}
    >
      {children}
    </div>
  ),
);
CardHeader.displayName = 'CardHeader';

export interface CardBodyProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export const CardBody = React.forwardRef<HTMLDivElement, CardBodyProps>(
  ({ className = '', children, ...rest }, ref) => (
    <div
      ref={ref}
      className={['px-4 py-4', className].filter(Boolean).join(' ')}
      {...rest}
    >
      {children}
    </div>
  ),
);
CardBody.displayName = 'CardBody';

export interface CardFooterProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export const CardFooter = React.forwardRef<HTMLDivElement, CardFooterProps>(
  ({ className = '', children, ...rest }, ref) => (
    <div
      ref={ref}
      className={['px-4 py-3 border-t border-border flex items-center gap-2', className].filter(Boolean).join(' ')}
      {...rest}
    >
      {children}
    </div>
  ),
);
CardFooter.displayName = 'CardFooter';

// ─────────────────────────────────────────────────────────────────────────────
// Input 输入框
// ─────────────────────────────────────────────────────────────────────────────

export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  /** 字段标签 */
  label?: string;
  /** 错误消息（有值时显示红色边框和提示） */
  error?: string;
  /** 辅助说明文字 */
  hint?: string;
  /** 左侧图标/装饰 */
  leftIcon?: React.ReactNode;
  /** 右侧图标/装饰 */
  rightIcon?: React.ReactNode;
  /** 尺寸 */
  size?: 'sm' | 'md' | 'lg';
}

const inputSizeClasses: Record<'sm' | 'md' | 'lg', string> = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-3 py-2 text-sm',
  lg: 'px-4 py-2.5 text-base',
};

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, leftIcon, rightIcon, size = 'md', className = '', id, ...rest }, ref) => {
    const inputId = id ?? (label ? `input-${label.replace(/\s+/g, '-').toLowerCase()}` : undefined);
    const hasError = Boolean(error);

    return (
      <div className="flex flex-col gap-1">
        {label && (
          <label
            htmlFor={inputId}
            className="text-sm font-medium text-text-primary"
          >
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          {leftIcon && (
            <span className="absolute left-3 text-text-tertiary pointer-events-none flex items-center">
              {leftIcon}
            </span>
          )}
          <input
            ref={ref}
            id={inputId}
            aria-invalid={hasError}
            aria-describedby={hasError ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
            className={[
              'w-full rounded-lg border bg-surface transition-colors duration-150',
              'placeholder:text-text-tertiary',
              'focus:outline-none focus:ring-2 focus:ring-offset-1 focus:border-transparent',
              hasError
                ? 'border-red-400 focus:ring-red-400'
                : 'border-border focus:ring-blue',
              inputSizeClasses[size],
              leftIcon ? 'pl-9' : '',
              rightIcon ? 'pr-9' : '',
              className,
            ].filter(Boolean).join(' ')}
            {...rest}
          />
          {rightIcon && (
            <span className="absolute right-3 text-text-tertiary pointer-events-none flex items-center">
              {rightIcon}
            </span>
          )}
        </div>
        {hasError && (
          <p id={`${inputId}-error`} className="text-xs text-red-500" role="alert">
            {error}
          </p>
        )}
        {!hasError && hint && (
          <p id={`${inputId}-hint`} className="text-xs text-text-secondary">
            {hint}
          </p>
        )}
      </div>
    );
  },
);
Input.displayName = 'Input';

// ─────────────────────────────────────────────────────────────────────────────
// Badge 徽章
// ─────────────────────────────────────────────────────────────────────────────

export type BadgeColor = 'blue' | 'green' | 'red' | 'yellow' | 'gray' | 'purple';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** 颜色变体 */
  color?: BadgeColor;
  /** 是否为实心样式（默认浅色背景） */
  solid?: boolean;
  children: React.ReactNode;
}

const badgeLightClasses: Record<BadgeColor, string> = {
  blue:   'bg-blue-50 text-blue-700 border-blue-200',
  green:  'bg-green-50 text-green-700 border-green-200',
  red:    'bg-red-50 text-red-700 border-red-200',
  yellow: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  gray:   'bg-surface-elevated text-text-primary border-border',
  purple: 'bg-purple-50 text-purple-700 border-purple-200',
};

const badgeSolidClasses: Record<BadgeColor, string> = {
  blue:   'bg-blue text-white border-blue',
  green:  'bg-green-600 text-white border-green-600',
  red:    'bg-red-600 text-white border-red-600',
  yellow: 'bg-yellow-500 text-white border-yellow-500',
  gray:   'bg-gray-600 text-white border-gray-600',
  purple: 'bg-purple-600 text-white border-purple-600',
};

export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ color = 'blue', solid = false, className = '', children, ...rest }, ref) => {
    const colorCls = solid ? badgeSolidClasses[color] : badgeLightClasses[color];
    return (
      <span
        ref={ref}
        className={[
          'inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full border',
          colorCls,
          className,
        ].filter(Boolean).join(' ')}
        {...rest}
      >
        {children}
      </span>
    );
  },
);
Badge.displayName = 'Badge';

// ─────────────────────────────────────────────────────────────────────────────
// ModuleCard 模块卡片（Dashboard 入口）
// ─────────────────────────────────────────────────────────────────────────────

export type ModuleCardStatus = 'active' | 'inactive' | 'locked' | 'coming_soon';

export interface ModuleCardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** 模块图标（SVG / emoji / icon component） */
  icon: React.ReactNode;
  /** 模块标题 */
  title: string;
  /** 模块描述（一行内） */
  description: string;
  /** 模块状态 */
  status?: ModuleCardStatus;
  /** 进度 0-1（可选，显示进度条） */
  progress?: number;
  /** 通知计数气泡 */
  badge?: number;
  /** 点击回调 */
  onClick?: () => void;
}

const statusConfig: Record<ModuleCardStatus, { label: string; dotColor: string; clickable: boolean }> = {
  active:       { label: '已开启', dotColor: 'bg-green-500',  clickable: true },
  inactive:     { label: '未开启', dotColor: 'bg-gray-400',   clickable: true },
  locked:       { label: '未解锁', dotColor: 'bg-yellow-400', clickable: false },
  coming_soon:  { label: '即将上线', dotColor: 'bg-blue-400',  clickable: false },
};

export const ModuleCard = React.forwardRef<HTMLDivElement, ModuleCardProps>(
  (
    {
      icon,
      title,
      description,
      status = 'active',
      progress,
      badge,
      onClick,
      className = '',
      ...rest
    },
    ref,
  ) => {
    const { label, dotColor, clickable } = statusConfig[status];
    const isClickable = clickable && onClick;

    const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (isClickable && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        onClick?.();
      }
    };

    return (
      <div
        ref={ref}
        role={isClickable ? 'button' : undefined}
        tabIndex={isClickable ? 0 : undefined}
        onClick={isClickable ? onClick : undefined}
        onKeyDown={isClickable ? handleKeyDown : undefined}
        aria-label={`${title} — ${label}`}
        className={[
          'relative flex flex-col gap-3 p-4 rounded-2xl border transition-all duration-150',
          'bg-surface border-border',
          isClickable ? 'cursor-pointer hover:border-blue-300 hover:shadow-sm active:scale-[0.98]' : 'cursor-default opacity-75',
          className,
        ].filter(Boolean).join(' ')}
        {...rest}
      >
        {/* 顶部：图标 + 状态 + 徽章 */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue/10 text-blue text-xl">
            {icon}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {badge !== undefined && badge > 0 && (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 text-white text-xs font-semibold px-1.5">
                {badge > 99 ? '99+' : badge}
              </span>
            )}
            <span className="flex items-center gap-1.5 text-xs text-text-secondary">
              <span className={`h-2 w-2 rounded-full ${dotColor}`} aria-hidden="true" />
              {label}
            </span>
          </div>
        </div>

        {/* 标题 + 描述 */}
        <div className="flex flex-col gap-0.5 min-w-0">
          <h3 className="text-sm font-semibold text-text-primary truncate">{title}</h3>
          <p className="text-xs text-text-secondary line-clamp-2">{description}</p>
        </div>

        {/* 进度条（可选） */}
        {progress !== undefined && (
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between text-xs text-text-secondary">
              <span>进度</span>
              <span>{Math.round(progress * 100)}%</span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-surface-elevated overflow-hidden">
              <div
                className="h-full rounded-full bg-blue transition-all duration-300"
                style={{ width: `${Math.min(100, Math.max(0, progress * 100))}%` }}
                role="progressbar"
                aria-valuenow={Math.round(progress * 100)}
                aria-valuemin={0}
                aria-valuemax={100}
              />
            </div>
          </div>
        )}
      </div>
    );
  },
);
ModuleCard.displayName = 'ModuleCard';
