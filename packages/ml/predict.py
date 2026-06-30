"""
录取概率预测 API
================
加载训练好的模型，对新的考生-院校组合预测录取概率

用法:
    from predict import predict_admission
    prob = predict_admission(
        student_rank=5000,
        university_id="xxx",
        province="广东",
        subject_type="物理类",
        year=2026,
    )
"""

import json
import joblib
import numpy as np
import pandas as pd
from pathlib import Path

MODEL_DIR = Path(__file__).parent / 'output' / 'models'
DATA_DIR = Path(__file__).parent / 'output' / 'data'

# 加载模型和元数据
_xgb_model = None
_lgb_model = None
_feature_meta = None
_universities = None


def _load_models():
    global _xgb_model, _lgb_model, _feature_meta, _universities
    if _xgb_model is None:
        _xgb_model = joblib.load(MODEL_DIR / 'xgboost_calibrated.pkl')
        _lgb_model = joblib.load(MODEL_DIR / 'lightgbm_calibrated.pkl')
        with open(DATA_DIR / 'feature_meta.json', 'r', encoding='utf-8') as f:
            _feature_meta = json.load(f)
        _universities = pd.read_csv(DATA_DIR / 'universities.csv')


def predict_admission(
    student_rank: int,
    min_rank: float,
    min_score: float,
    avg_score: float = None,
    is_985: bool = False,
    is_211: bool = False,
    is_dual_first_class: bool = False,
    tier_code: int = 3,
    school_type_code: int = 0,
    uni_rank: float = 100,
    best_discipline: float = 5,
    province_code: int = 0,
    year: int = 2026,
    score_line_est: float = 400,
    line_diff: float = 50,
    score_spread: float = 10,
    model: str = 'ensemble',
) -> dict:
    """
    预测录取概率

    Args:
        student_rank: 考生位次
        min_rank: 该校该专业历年最低录取位次（加权平均）
        min_score: 历年最低录取分
        model: 'xgboost' | 'lightgbm' | 'ensemble'

    Returns:
        dict with probability, tier, confidence
    """
    _load_models()

    if avg_score is None:
        avg_score = min_score

    rank_ratio = student_rank / max(min_rank, 1)

    features = {
        'rank_ratio': rank_ratio,
        'log_rank_ratio': np.log(rank_ratio + 1e-6),
        'score_gap_ratio': rank_ratio - 1.0,
        'student_rank': student_rank,
        'min_rank': min_rank,
        'rank_log_diff': np.log(student_rank + 1) - np.log(min_rank + 1),
        'min_score': min_score,
        'avg_score': avg_score,
        'score_spread': score_spread,
        'score_line_est': score_line_est,
        'line_diff': line_diff,
        'student_line_diff': line_diff * (1 + (rank_ratio - 1) * 0.5),
        'is_985': int(is_985),
        'is_211': int(is_211),
        'is_dual_first_class': int(is_dual_first_class),
        'tier_code': tier_code,
        'school_type_code': school_type_code,
        'uni_rank_log': np.log(uni_rank + 1),
        'best_discipline': best_discipline,
        'province_code': province_code,
        'year': year,
        'year_norm': (year - 2020) / 5.0,
        'rank_tier_interaction': rank_ratio * tier_code,
        'is985_rank_ratio': int(is_985) * rank_ratio,
    }

    feature_names = _feature_meta['feature_names']
    X = pd.DataFrame([{k: features.get(k, 0) for k in feature_names}])

    xgb_prob = _xgb_model.predict_proba(X)[0, 1]
    lgb_prob = _lgb_model.predict_proba(X)[0, 1]

    if model == 'xgboost':
        prob = xgb_prob
    elif model == 'lightgbm':
        prob = lgb_prob
    else:  # ensemble
        prob = 0.6 * xgb_prob + 0.4 * lgb_prob

    # 冲稳保分层
    if prob >= 0.75:
        tier = 'SAFE'
    elif prob >= 0.40:
        tier = 'STABLE'
    else:
        tier = 'RUSH'

    # 置信度（基于两模型一致性）
    agreement = 1 - abs(xgb_prob - lgb_prob)
    confidence = 'high' if agreement > 0.9 else 'medium' if agreement > 0.7 else 'low'

    return {
        'probability': round(prob * 100, 1),
        'xgboost_prob': round(xgb_prob * 100, 1),
        'lightgbm_prob': round(lgb_prob * 100, 1),
        'tier': tier,
        'confidence': confidence,
        'rank_ratio': round(rank_ratio, 3),
    }


if __name__ == '__main__':
    # 示例：位次 5000 的考生报考最低位次 8000 的 985 院校
    result = predict_admission(
        student_rank=5000,
        min_rank=8000,
        min_score=620,
        avg_score=635,
        is_985=True,
        is_211=True,
        is_dual_first_class=True,
        tier_code=0,
        uni_rank=30,
        best_discipline=2,
    )
    print(f"录取概率: {result['probability']}%")
    print(f"分层: {result['tier']}")
    print(f"置信度: {result['confidence']}")
    print(f"位次比: {result['rank_ratio']}")
    print(f"  XGBoost: {result['xgboost_prob']}%")
    print(f"  LightGBM: {result['lightgbm_prob']}%")
