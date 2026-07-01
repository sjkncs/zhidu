import { describe, it, expect } from 'vitest';
import { fallbackPredict } from '../ml-predict-client';
import type { MLPredictInput } from '../ml-predict-client';

function makeInput(overrides: Partial<MLPredictInput> = {}): MLPredictInput {
  return {
    studentRank: 5000,
    minRank: 8000,
    minScore: 620,
    ...overrides,
  };
}

describe('fallbackPredict — tier classification', () => {
  it('classifies SAFE when student rank is much better than min rank', () => {
    // rankRatio = 3000/8000 = 0.375 (<<0.7)
    const result = fallbackPredict(makeInput({ studentRank: 3000 }));
    expect(result.tier).toBe('SAFE');
    expect(result.probability).toBeGreaterThanOrEqual(75);
    expect(result.mlUsed).toBe(false);
  });

  it('classifies SAFE when rankRatio is 0.5', () => {
    // rankRatio = 4000/8000 = 0.5
    const result = fallbackPredict(makeInput({ studentRank: 4000 }));
    expect(result.tier).toBe('SAFE');
    expect(result.probability).toBeGreaterThanOrEqual(75);
  });

  it('classifies STABLE when student rank is close to min rank', () => {
    // rankRatio = 7200/8000 = 0.9 (between 0.85 and 1.0 → probability 70 → STABLE)
    const result = fallbackPredict(makeInput({ studentRank: 7200 }));
    expect(result.tier).toBe('STABLE');
    expect(result.probability).toBeGreaterThanOrEqual(40);
    expect(result.probability).toBeLessThan(75);
  });

  it('classifies RUSH when student rank is worse than min rank', () => {
    // rankRatio = 10000/8000 = 1.25 (between 1.0 and 1.3)
    const result = fallbackPredict(makeInput({ studentRank: 10000 }));
    expect(result.tier).toBe('RUSH');
    expect(result.probability).toBeLessThan(40);
  });

  it('classifies RUSH with very low probability when rankRatio >> 1.8', () => {
    // rankRatio = 20000/8000 = 2.5
    const result = fallbackPredict(makeInput({ studentRank: 20000 }));
    expect(result.tier).toBe('RUSH');
    expect(result.probability).toBeLessThan(10);
  });
});

describe('fallbackPredict — probability boundaries', () => {
  it('probability is clamped between 1 and 99', () => {
    const veryGood = fallbackPredict(makeInput({ studentRank: 100, minRank: 100000 }));
    expect(veryGood.probability).toBeLessThanOrEqual(99);
    expect(veryGood.probability).toBeGreaterThanOrEqual(1);

    const veryBad = fallbackPredict(makeInput({ studentRank: 500000, minRank: 1000 }));
    expect(veryBad.probability).toBeLessThanOrEqual(99);
    expect(veryBad.probability).toBeGreaterThanOrEqual(1);
  });

  it('probability at rankRatio=0.7 boundary is ~90', () => {
    const result = fallbackPredict(makeInput({ studentRank: 7000, minRank: 10000 }));
    expect(result.probability).toBeCloseTo(90, -1);
  });

  it('probability at rankRatio=1.0 boundary is ~60', () => {
    const result = fallbackPredict(makeInput({ studentRank: 10000, minRank: 10000 }));
    expect(result.probability).toBeCloseTo(60, -1);
  });

  it('probability at rankRatio=1.3 boundary is ~20', () => {
    const result = fallbackPredict(makeInput({ studentRank: 13000, minRank: 10000 }));
    expect(result.probability).toBeCloseTo(20, -1);
  });
});

describe('fallbackPredict — edge cases', () => {
  it('handles minRank=0 gracefully (does not divide by zero)', () => {
    const result = fallbackPredict(makeInput({ studentRank: 5000, minRank: 0 }));
    expect(result.probability).toBeGreaterThanOrEqual(1);
    expect(result.probability).toBeLessThanOrEqual(99);
  });

  it('handles minRank=1 with high studentRank', () => {
    const result = fallbackPredict(makeInput({ studentRank: 100000, minRank: 1 }));
    expect(result.tier).toBe('RUSH');
  });

  it('returns mlUsed=false for all fallback predictions', () => {
    const result = fallbackPredict(makeInput());
    expect(result.mlUsed).toBe(false);
    expect(result.confidence).toBe('low');
  });

  it('xgboostProb and lightgbmProb equal probability in fallback', () => {
    const result = fallbackPredict(makeInput());
    expect(result.xgboostProb).toBe(result.probability);
    expect(result.lightgbmProb).toBe(result.probability);
  });
});

describe('fallbackPredict — monotonicity', () => {
  it('probability decreases as student rank gets worse (higher number)', () => {
    const ranks = [3000, 5000, 7000, 9000, 12000, 20000];
    const probs = ranks.map(r => fallbackPredict(makeInput({ studentRank: r })).probability);

    for (let i = 1; i < probs.length; i++) {
      expect(probs[i]).toBeLessThanOrEqual(probs[i - 1]);
    }
  });
});
