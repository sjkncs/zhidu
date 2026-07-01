"""
录取概率预测 API (v2)
=====================
加载训练好的模型，对新的考生-院校组合预测录取概率。
使用共享特征模块 (features.py) 保证训练-推理特征一致。

用法:
    from predict import predict_admission
    result = predict_admission(
        student_rank=5000, min_rank=8000, min_score=620,
        avg_score=635, is_985=True, ...
    )
"""

import json
import joblib
import numpy as np
import pandas as pd
from pathlib import Path

from features import FEATURE_NAMES, build_inference_features

MODEL_DIR = Path(__file__).parent / 'output' / 'models'
DATA_DIR = Path(__file__).parent / 'output' / 'data'

# 加载模型和元数据
_xgb_model = None
_lgb_model = None
_feature_meta = None


def _load_models():
    global _xgb_model, _lgb_model, _feature_meta
    if _xgb_model is None:
        _xgb_model = joblib.load(MODEL_DIR / 'xgboost_calibrated.pkl')
        _lgb_model = joblib.load(MODEL_DIR / 'lightgbm_calibrated.pkl')
        try:
            with open(DATA_DIR / 'feature_meta.json', 'r', encoding='utf-8') as f:
                _feature_meta = json.load(f)
        except Exception:
            _feature_meta = {'version': 'unknown'}


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
    预测录取概率 (v2)

    使用共享特征模块 (features.py) 构建特征，
    保证训练和推理使用完全相同的 19 维特征。

    Args:
        student_rank:       考生位次
        min_rank:           该校该专业历年最低录取位次（加权平均）
        min_score:          历年最低录取分
        avg_score:          历年平均录取分
        is_985/211/dfc:     院校标志
        tier_code:          办学层次编码
        school_type_code:   学校类型编码
        uni_rank:           院校综合排名
        best_discipline:    最佳学科评估等级数值
        province_code:      省份编码
        year:               年份
        score_line_est:     省控线估计
        line_diff:          线差 (min_score - 省控线)
        score_spread:       分数离散度 (avg_score - min_score)
        model:              'xgboost' | 'lightgbm' | 'ensemble'

    Returns:
        dict with probability, tier, confidence, feature_version
    """
    _load_models()

    # 使用共享特征模块构建 19 维特征
    features = build_inference_features(
        student_rank=student_rank,
        min_rank=min_rank,
        min_score=min_score,
        avg_score=avg_score,
        is_985=is_985,
        is_211=is_211,
        is_dual_first_class=is_dual_first_class,
        tier_code=tier_code,
        school_type_code=school_type_code,
        uni_rank=uni_rank,
        best_discipline=best_discipline,
        province_code=province_code,
        year=year,
        score_line_est=score_line_est,
        line_diff=line_diff,
        score_spread=score_spread,
    )

    X = pd.DataFrame([{k: features.get(k, 0) for k in FEATURE_NAMES}])

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

    rank_ratio = student_rank / max(min_rank, 1)

    return {
        'probability': round(prob * 100, 1),
        'xgboost_prob': round(xgb_prob * 100, 1),
        'lightgbm_prob': round(lgb_prob * 100, 1),
        'tier': tier,
        'confidence': confidence,
        'rank_ratio': round(rank_ratio, 3),
        'feature_version': (_feature_meta or {}).get('version', 'unknown'),
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
    print(f"特征版本: {result['feature_version']}")
    print(f"  XGBoost: {result['xgboost_prob']}%")
    print(f"  LightGBM: {result['lightgbm_prob']}%")
