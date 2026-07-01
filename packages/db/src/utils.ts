/**
 * @zhidu/db — 内部工具函数
 * 从 repository.ts 提取，便于单元测试和复用
 */

import { createClient, type SupabaseClient, type Database } from './index';

// Lazy-initialized client to avoid circular dependency at module load time.
let _db: SupabaseClient<Database> | null = null;

/** Get the shared Supabase client instance */
export function getDb(): SupabaseClient<Database> {
  if (!_db) {
    _db = createClient();
  }
  return _db;
}

/** Convert a snake_case key to camelCase */
export function snakeToCamel(s: string): string {
  return s.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
}

/** Recursively convert all keys of an object (or array of objects) from snake_case to camelCase */
export function toCamel<T>(input: unknown): T {
  if (Array.isArray(input)) {
    return input.map((item) => toCamel(item)) as T;
  }
  if (input !== null && typeof input === 'object' && !(input instanceof Date)) {
    const obj = input as Record<string, unknown>;
    const result: Record<string, unknown> = {};
    for (const key of Object.keys(obj)) {
      result[snakeToCamel(key)] = toCamel(obj[key]);
    }
    return result as T;
  }
  return input as T;
}

/** Convert camelCase key to snake_case for query building */
export function camelToSnake(s: string): string {
  return s.replace(/[A-Z]/g, (c) => '_' + c.toLowerCase());
}
