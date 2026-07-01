"""
智渡录取概率推理微服务
======================
Flask API，加载训练好的 XGBoost + LightGBM 模型，
提供录取概率推理接口供 Next.js 志愿引擎调用。

启动: python serve.py
端口: 5100

安全特性:
- API Key 鉴权 (ML_API_KEY 环境变量)
- CORS 限制到指定前端域名
- 请求速率限制
- 输入参数验证
- Batch 大小限制
"""

import json
import logging
import os
import time
import functools
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from flask import Flask, request, jsonify, g
from flask_cors import CORS

from features import FEATURE_NAMES, build_inference_features

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ─── 配置 ─────────────────────────────────────────────────────────────────

ML_API_KEY = os.environ.get('ML_API_KEY', '')
ALLOWED_ORIGINS = os.environ.get('ML_CORS_ORIGINS', 'http://localhost:3000').split(',')
RATE_LIMIT_WINDOW = 60  # 秒
RATE_LIMIT_MAX = 120    # 每窗口最大请求数

app = Flask(__name__)
CORS(app, origins=ALLOWED_ORIGINS)

# ─── 全局模型 ───────────────────────────────────────────────────────────────

MODEL_DIR = Path(__file__).parent / 'output' / 'models'
DATA_DIR = Path(__file__).parent / 'output' / 'data'

_xgb_model = None
_lgb_model = None
_feature_meta = None

# ─── 速率限制（内存滑动窗口）─────────────────────────────────────────────

_rate_store: dict[str, dict] = {}


def _check_rate_limit(client_ip: str) -> bool:
    now = time.time()
    entry = _rate_store.get(client_ip)

    if not entry or now > entry['reset_at']:
        _rate_store[client_ip] = {'count': 1, 'reset_at': now + RATE_LIMIT_WINDOW}
        return True

    entry['count'] += 1
    return entry['count'] <= RATE_LIMIT_MAX


# ─── 鉴权 + 速率限制中间件 ──────────────────────────────────────────────

def require_api_key(f):
    """API Key 鉴权装饰器"""
    @functools.wraps(f)
    def decorated(*args, **kwargs):
        # 健康检查不需要鉴权
        if request.path == '/health':
            return f(*args, **kwargs)

        # API Key 验证
        if ML_API_KEY:
            provided_key = request.headers.get('X-API-Key', '')
            if provided_key != ML_API_KEY:
                return jsonify({'error': 'Invalid or missing API key'}), 401

        # 速率限制
        client_ip = request.remote_addr or 'unknown'
        if not _check_rate_limit(client_ip):
            return jsonify({'error': 'Rate limit exceeded. Try again later.'}), 429

        return f(*args, **kwargs)
    return decorated


# ─── 模型加载 ──────────────────────────────────────────────────────────────

def load_models():
    global _xgb_model, _lgb_model, _feature_meta
    if _xgb_model is not None:
        return

    logger.info("Loading models...")
    _xgb_model = joblib.load(MODEL_DIR / 'xgboost_calibrated.pkl')
    _lgb_model = joblib.load(MODEL_DIR / 'lightgbm_calibrated.pkl')

    try:
        with open(DATA_DIR / 'feature_meta.json', 'r', encoding='utf-8') as f:
            _feature_meta = json.load(f)
    except Exception:
        _feature_meta = {'version': 'unknown'}

    logger.info(f"Models loaded. Features: {len(FEATURE_NAMES)} (shared module)")


def predict(features: dict, model: str = 'ensemble') -> dict:
    """核心推理函数 (v2 — 使用共享特征模块)"""
    load_models()

    X = pd.DataFrame([{k: features.get(k, 0) for k in FEATURE_NAMES}])

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
        'feature_version': (_feature_meta or {}).get('version', 'unknown'),
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
    """
    从业务参数构建特征向量 (v2)

    委托给共享特征模块 features.build_inference_features()，
    保证训练-推理特征严格一致。
    """
    return build_inference_features(
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


# ─── 输入验证 ──────────────────────────────────────────────────────────────

REQUIRED_FIELDS = {'student_rank', 'min_rank', 'min_score'}
VALID_MODELS = {'ensemble', 'xgboost', 'lightgbm'}
MAX_BATCH_SIZE = 100


def validate_prediction_input(data: dict) -> str | None:
    """验证预测输入，返回错误信息或 None"""
    if not isinstance(data, dict):
        return 'Request body must be a JSON object'

    missing = REQUIRED_FIELDS - set(data.keys())
    if missing:
        return f'Missing required fields: {", ".join(sorted(missing))}'

    # 类型检查
    if not isinstance(data.get('student_rank'), (int, float)):
        return 'student_rank must be a number'
    if not isinstance(data.get('min_rank'), (int, float)):
        return 'min_rank must be a number'
    if not isinstance(data.get('min_score'), (int, float)):
        return 'min_score must be a number'

    # 范围检查
    if data['student_rank'] <= 0 or data['student_rank'] > 2_000_000:
        return 'student_rank out of valid range (1-2000000)'
    if data['min_rank'] <= 0 or data['min_rank'] > 2_000_000:
        return 'min_rank out of valid range (1-2000000)'
    if data['min_score'] < 0 or data['min_score'] > 750:
        return 'min_score out of valid range (0-750)'

    return None


# ─── API Routes ─────────────────────────────────────────────────────────────

@app.before_request
@require_api_key
def before_request_hook():
    pass


@app.route('/health', methods=['GET'])
def health():
    models_loaded = _xgb_model is not None
    return jsonify({
        'status': 'ok',
        'model': 'admission-predictor',
        'models_loaded': models_loaded,
        'feature_version': (_feature_meta or {}).get('version', 'unknown'),
        'feature_count': len(FEATURE_NAMES),
    })


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

    Headers:
        X-API-Key: <ML_API_KEY>
    """
    data = request.get_json()
    if not data:
        return jsonify({'error': 'Missing JSON body'}), 400

    # 输入验证
    error = validate_prediction_input(data)
    if error:
        return jsonify({'error': error}), 400

    model = data.pop('model', 'ensemble')
    if model not in VALID_MODELS:
        return jsonify({'error': f'Invalid model: {model}. Must be one of: {VALID_MODELS}'}), 400

    try:
        features = build_features(**data)
        result = predict(features, model=model)
        return jsonify({'status': 'ok', 'data': result})
    except TypeError as e:
        return jsonify({'error': f'Invalid parameters: {str(e)}'}), 400
    except Exception as e:
        logger.error(f"Prediction error: {e}")
        return jsonify({'error': 'Internal prediction error'}), 500


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

    Headers:
        X-API-Key: <ML_API_KEY>
    """
    data = request.get_json()
    if not data or 'items' not in data:
        return jsonify({'error': 'Missing "items" array in body'}), 400

    items = data['items']
    if not isinstance(items, list):
        return jsonify({'error': '"items" must be an array'}), 400

    if len(items) > MAX_BATCH_SIZE:
        return jsonify({'error': f'Batch too large. Max {MAX_BATCH_SIZE} items.'}), 400

    results = []
    errors = []

    for i, item in enumerate(items):
        # 逐条验证
        error = validate_prediction_input(item)
        if error:
            errors.append({'index': i, 'error': error})
            continue

        model = item.pop('model', 'ensemble')
        if model not in VALID_MODELS:
            errors.append({'index': i, 'error': f'Invalid model: {model}'})
            continue

        try:
            features = build_features(**item)
            result = predict(features, model=model)
            results.append({'index': i, **result})
        except Exception as e:
            errors.append({'index': i, 'error': str(e)})

    return jsonify({
        'status': 'ok',
        'results': results,
        'errors': errors,
        'total': len(items),
        'success_count': len(results),
        'error_count': len(errors),
    })


@app.errorhandler(404)
def not_found(e):
    return jsonify({'error': 'Not found'}), 404


@app.errorhandler(500)
def internal_error(e):
    return jsonify({'error': 'Internal server error'}), 500


if __name__ == '__main__':
    load_models()
    logger.info("Starting admission predictor on port 5100")
    if ML_API_KEY:
        logger.info("API key authentication enabled")
    else:
        logger.warning("WARNING: No ML_API_KEY set. Authentication is disabled!")
    app.run(host='0.0.0.0', port=5100, debug=False)
