/**
 * ML 录取概率推理客户端
 *
 * 调用 packages/ml/serve.py 的 Flask API 进行录取概率预测。
 * 当 ML 服务不可用时，自动回退到规则引擎（位次法 + 线差法）。
 */

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:5100';
const ML_TIMEOUT_MS = 5000;

export interface MLPredictInput {
  studentRank: number;
  minRank: number;
  minScore: number;
  avgScore?: number;
  is985?: boolean;
  is211?: boolean;
  isDualFirstClass?: boolean;
  tierCode?: number;
  schoolTypeCode?: number;
  uniRank?: number;
  bestDiscipline?: number;
  provinceCode?: number;
  year?: number;
  scoreLineEst?: number;
  lineDiff?: number;
  scoreSpread?: number;
}

export interface MLPredictResult {
  probability: number;
  xgboostProb: number;
  lightgbmProb: number;
  tier: 'RUSH' | 'STABLE' | 'SAFE';
  confidence: 'high' | 'medium' | 'low';
  /** 是否使用了 ML 模型（false 表示回退到规则引擎） */
  mlUsed: boolean;
}

/**
 * 调用 ML 服务预测单个院校专业的录取概率
 */
export async function predictAdmission(
  input: MLPredictInput,
): Promise<MLPredictResult> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ML_TIMEOUT_MS);

    const response = await fetch(`${ML_SERVICE_URL}/predict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        student_rank: input.studentRank,
        min_rank: input.minRank,
        min_score: input.minScore,
        avg_score: input.avgScore ?? input.minScore,
        is_985: input.is985 ?? false,
        is_211: input.is211 ?? false,
        is_dual_first_class: input.isDualFirstClass ?? false,
        tier_code: input.tierCode ?? 3,
        school_type_code: input.schoolTypeCode ?? 0,
        uni_rank: input.uniRank ?? 100,
        best_discipline: input.bestDiscipline ?? 5,
        province_code: input.provinceCode ?? 0,
        year: input.year ?? new Date().getFullYear(),
        score_line_est: input.scoreLineEst ?? 400,
        line_diff: input.lineDiff ?? 50,
        score_spread: input.scoreSpread ?? 10,
        model: 'ensemble',
      }),
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (!response.ok) {
      throw new Error(`ML service error: ${response.status}`);
    }

    const data = await response.json();

    return {
      probability: data.probability,
      xgboostProb: data.xgboost_prob,
      lightgbmProb: data.lightgbm_prob,
      tier: data.tier,
      confidence: data.confidence,
      mlUsed: true,
    };
  } catch (err) {
    console.warn('[ML] Prediction failed, falling back to rule engine:', err);
    return fallbackPredict(input);
  }
}

/**
 * 批量预测
 */
export async function predictBatch(
  inputs: MLPredictInput[],
): Promise<MLPredictResult[]> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ML_TIMEOUT_MS * 3);

    const response = await fetch(`${ML_SERVICE_URL}/predict/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: inputs.map((input) => ({
          student_rank: input.studentRank,
          min_rank: input.minRank,
          min_score: input.minScore,
          avg_score: input.avgScore ?? input.minScore,
          is_985: input.is985 ?? false,
          is_211: input.is211 ?? false,
          is_dual_first_class: input.isDualFirstClass ?? false,
          tier_code: input.tierCode ?? 3,
          school_type_code: input.schoolTypeCode ?? 0,
          uni_rank: input.uniRank ?? 100,
          best_discipline: input.bestDiscipline ?? 5,
          province_code: input.provinceCode ?? 0,
          year: input.year ?? new Date().getFullYear(),
          score_line_est: input.scoreLineEst ?? 400,
          line_diff: input.lineDiff ?? 50,
          score_spread: input.scoreSpread ?? 10,
        })),
      }),
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (!response.ok) {
      throw new Error(`ML service error: ${response.status}`);
    }

    const data = await response.json();

    return data.results.map((r: any) => ({
      probability: r.probability,
      xgboostProb: r.xgboost_prob,
      lightgbmProb: r.lightgbm_prob,
      tier: r.tier,
      confidence: r.confidence,
      mlUsed: true,
    }));
  } catch (err) {
    console.warn('[ML] Batch prediction failed, falling back:', err);
    return inputs.map(fallbackPredict);
  }
}

/**
 * 检查 ML 服务是否可用
 */
export async function isMLServiceAvailable(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2000);
    const response = await fetch(`${ML_SERVICE_URL}/health`, {
      signal: controller.signal,
    });
    clearTimeout(timer);
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * 规则引擎回退（原始位次法 + 线差法简化版）
 */
function fallbackPredict(input: MLPredictInput): MLPredictResult {
  const rankRatio = input.studentRank / Math.max(input.minRank, 1);

  let probability: number;
  if (rankRatio <= 0.7) {
    probability = 90 + (0.7 - rankRatio) * 20;
    probability = Math.min(probability, 99);
  } else if (rankRatio <= 1.0) {
    probability = 60 + (1.0 - rankRatio) * 100;
  } else if (rankRatio <= 1.3) {
    probability = 20 + (1.3 - rankRatio) * 133;
  } else if (rankRatio <= 1.8) {
    probability = Math.max(5, 20 - (rankRatio - 1.3) * 30);
  } else {
    probability = 3;
  }

  probability = Math.round(Math.max(1, Math.min(99, probability)));

  let tier: 'RUSH' | 'STABLE' | 'SAFE';
  if (probability >= 75) tier = 'SAFE';
  else if (probability >= 40) tier = 'STABLE';
  else tier = 'RUSH';

  return {
    probability,
    xgboostProb: probability,
    lightgbmProb: probability,
    tier,
    confidence: 'low',
    mlUsed: false,
  };
}
