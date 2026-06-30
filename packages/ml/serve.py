"""
智渡录取概率推理微服务
======================
Flask API，加载训练好的 XGBoost + LightGBM 模型，
提供录取概率推理接口供 Next.js 志愿引擎调用。

启动: python serve.py
端口: 5100
"""

import json
import logging
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from flask import Flask, request, jsonify
from flask_cors import CORS

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)

# ─── 全局模型 ───────────────────────────────────────────────────────────────

MODEL_DIR = Path(__file__).parent / 'output' / 'models'
DATA_DIR = Path(__file__).parent / 'output' / 'data'

_xgb_model = None
_lgb_model = None
_feature_meta = None


def load_models():
    global _xgb_model, _lgb_model, _feature_meta
    if _xgb_model is not None:
        return

    logger.info("Loading models...")
    _xgb_model = joblib.load(MODEL_DIR / 'xgboost_calibrated.pkl')
    _lgb_model = joblib.load(MODEL_DIR / 'lightgbm_calibrated.pkl')

    with open(DATA_DIR / 'feature_meta.json', 'r', encoding='utf-8') as f:
        _feature_meta = json.load(f)

    logger.info(f"Models loaded. Features: {len(_feature_meta['feature_names'])}")


def predict(features: dict, model: str = 'ensemble') -> dict:
    """核心推理函数"""
    load_models()

    feature_names = _feature_meta['feature_names']
    X = pd.DataFrame([{k: features.get(k, 0) for k in feature_names}])

    xgb_prob = float(_xgb_model.predict_proba(X)[0, 1])
    lgb_prob = float(_lgb_model.predict_proba(X)[0, 1])

    if model == 'xgboost':
        prob = xgb_prob
    elif model == 'lightgbm':
        prob = lgb_prob
    else:
        prob = 0.6 * xgb_prob + 0.4 * lgb_prob

    # 冲稳保分层
    if prob >= 0.75:
        tier = 'SAFE'
    elif prob >= 0.40:
        tier = 'STABLE'
    else:
        tier = 'RUSH'

    # 置信度
    agreement = 1 - abs(xgb_prob - lgb_prob)
    confidence = 'high' if agreement > 0.9 else 'medium' if agreement > 0.7 else 'low'

    return {
        'probability': round(prob * 100, 1),
        'xgboost_prob': round(xgb_prob * 100, 1),
        'lightgbm_prob': round(lgb_prob * 100, 1),
        'tier': tier,
        'confidence': confidence,
    }


def build_features(
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
) -> dict:
    """从业务参数构建特征向量"""
    if avg_score is None:
        avg_score = min_score

    rank_ratio = student_rank / max(min_rank, 1)

    return {
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


# ─── API Routes ─────────────────────────────────────────────────────────────

@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok', 'model': 'admission-predictor'})


@app.route('/predict', methods=['POST'])
def predict_endpoint():
    """
    预测录取概率

    Body:
    {
        "student_rank": 5000,
        "min_rank": 8000,
        "min_score": 620,
        "avg_score": 635,
        "is_985": true,
        ...
    }
    """
    data = request.get_json()
    if not data:
        return jsonify({'error': 'Missing JSON body'}), 400

    model = data.pop('model', 'ensemble')
    features = build_features(**data)
    result = predict(features, model=model)

    return jsonify(result)


@app.route('/predict/batch', methods=['POST'])
def predict_batch():
    """
    批量预测

    Body:
    {
        "items": [
            {"student_rank": 5000, "min_rank": 8000, ...},
            ...
        ]
    }
    """
    data = request.get_json()
    items = data.get('items', [])

    results = []
    for item in items:
        model = item.pop('model', 'ensemble')
        features = build_features(**item)
        result = predict(features, model=model)
        results.append(result)

    return jsonify({'results': results})


if __name__ == '__main__':
    load_models()
    logger.info("Starting admission predictor on port 5100")
    app.run(host='0.0.0.0', port=5100, debug=False)
