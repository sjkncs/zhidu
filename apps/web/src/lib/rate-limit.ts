/**
 * API 速率限制工具
 *
 * 基于内存的滑动窗口速率限制器，用于 Next.js API Routes。
 * 注意：仅适用于单实例部署。多实例需改用 Redis/Upstash。
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

// 每 60 秒清理过期条目
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (now > entry.resetAt) store.delete(key);
  }
}, 60_000);

export interface RateLimitConfig {
  /** 时间窗口（毫秒） */
  windowMs: number;
  /** 窗口内最大请求数 */
  maxRequests: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  retryAfterMs: number;
}

/**
 * 检查是否允许请求通过
 */
export function checkRateLimit(
  key: string,
  config: RateLimitConfig,
): RateLimitResult {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    // 新窗口
    store.set(key, { count: 1, resetAt: now + config.windowMs });
    return {
      allowed: true,
      remaining: config.maxRequests - 1,
      resetAt: now + config.windowMs,
      retryAfterMs: 0,
    };
  }

  entry.count++;

  if (entry.count > config.maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: entry.resetAt,
      retryAfterMs: entry.resetAt - now,
    };
  }

  return {
    allowed: true,
    remaining: config.maxRequests - entry.count,
    resetAt: entry.resetAt,
    retryAfterMs: 0,
  };
}

/**
 * 从请求中提取用户标识（优先 userId，降级到 IP）
 */
export function getRateLimitKey(request: Request): string {
  const userId = request.headers.get('x-user-id');
  if (userId) return `user:${userId}`;

  const forwarded = request.headers.get('x-forwarded-for');
  const ip = forwarded?.split(',')[0]?.trim() ?? 'unknown';
  return `ip:${ip}`;
}

/**
 * 创建速率限制响应 (429 Too Many Requests)
 */
export function rateLimitResponse(result: RateLimitResult): Response {
  return new Response(
    JSON.stringify({
      error: '请求过于频繁，请稍后再试',
      retryAfterMs: result.retryAfterMs,
    }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': String(Math.ceil(result.retryAfterMs / 1000)),
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': String(result.resetAt),
      },
    },
  );
}

// ─── 预设配置 ──────────────────────────────────────────────────────────────

/** AI 对话接口：每用户每分钟 10 次 */
export const AI_CHAT_LIMIT: RateLimitConfig = {
  windowMs: 60_000,
  maxRequests: 10,
};

/** 知识库写入接口：每用户每分钟 5 次 */
export const KNOWLEDGE_WRITE_LIMIT: RateLimitConfig = {
  windowMs: 60_000,
  maxRequests: 5,
};

/** 通用 API：每 IP 每分钟 30 次 */
export const GENERAL_API_LIMIT: RateLimitConfig = {
  windowMs: 60_000,
  maxRequests: 30,
};
