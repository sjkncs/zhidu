import { describe, it, expect } from 'vitest';
import { snakeToCamel, toCamel, camelToSnake } from '../utils';

describe('snakeToCamel', () => {
  it('converts simple snake_case to camelCase', () => {
    expect(snakeToCamel('user_name')).toBe('userName');
    expect(snakeToCamel('first_name')).toBe('firstName');
    expect(snakeToCamel('created_at')).toBe('createdAt');
  });

  it('handles single word (no underscore)', () => {
    expect(snakeToCamel('name')).toBe('name');
    expect(snakeToCamel('id')).toBe('id');
  });

  it('handles multiple underscores', () => {
    expect(snakeToCamel('min_admission_score')).toBe('minAdmissionScore');
    expect(snakeToCamel('is_dual_first_class')).toBe('isDualFirstClass');
  });

  it('handles empty string', () => {
    expect(snakeToCamel('')).toBe('');
  });

  it('does not convert uppercase after underscore', () => {
    // Only matches _[a-z], so _A stays as-is
    expect(snakeToCamel('some_ID')).toBe('some_ID');
  });
});

describe('camelToSnake', () => {
  it('converts camelCase to snake_case', () => {
    expect(camelToSnake('userName')).toBe('user_name');
    expect(camelToSnake('firstName')).toBe('first_name');
    expect(camelToSnake('createdAt')).toBe('created_at');
  });

  it('handles single word (no uppercase)', () => {
    expect(camelToSnake('name')).toBe('name');
    expect(camelToSnake('id')).toBe('id');
  });

  it('handles multiple uppercase letters', () => {
    expect(camelToSnake('minAdmissionScore')).toBe('min_admission_score');
    expect(camelToSnake('isDualFirstClass')).toBe('is_dual_first_class');
  });

  it('handles empty string', () => {
    expect(camelToSnake('')).toBe('');
  });
});

describe('toCamel', () => {
  it('converts object keys from snake_case to camelCase', () => {
    const input = { user_name: 'Alice', first_name: 'Smith', age: 25 };
    const result = toCamel<Record<string, unknown>>(input);
    expect(result).toEqual({ userName: 'Alice', firstName: 'Smith', age: 25 });
  });

  it('handles nested objects', () => {
    const input = {
      user_name: 'Alice',
      profile_data: { birth_date: '2000-01-01', home_city: 'Beijing' },
    };
    const result = toCamel<Record<string, unknown>>(input);
    expect(result).toEqual({
      userName: 'Alice',
      profileData: { birthDate: '2000-01-01', homeCity: 'Beijing' },
    });
  });

  it('handles arrays of objects', () => {
    const input = [
      { user_name: 'Alice', min_score: 620 },
      { user_name: 'Bob', min_score: 580 },
    ];
    const result = toCamel<Array<Record<string, unknown>>>(input);
    expect(result).toEqual([
      { userName: 'Alice', minScore: 620 },
      { userName: 'Bob', minScore: 580 },
    ]);
  });

  it('preserves null values', () => {
    expect(toCamel(null)).toBeNull();
  });

  it('preserves primitive values', () => {
    expect(toCamel(42)).toBe(42);
    expect(toCamel('hello')).toBe('hello');
    expect(toCamel(true)).toBe(true);
  });

  it('preserves Date objects', () => {
    const date = new Date('2026-01-01');
    expect(toCamel(date)).toBe(date);
  });

  it('handles empty object', () => {
    expect(toCamel({})).toEqual({});
  });

  it('handles empty array', () => {
    expect(toCamel([])).toEqual([]);
  });

  it('roundtrip: toCamel(snakeCase) matches original camelCase', () => {
    const keys = ['userName', 'firstName', 'createdAt', 'minAdmissionScore', 'isDualFirstClass'];
    for (const key of keys) {
      const snake = camelToSnake(key);
      const back = snakeToCamel(snake);
      expect(back).toBe(key);
    }
  });
});
