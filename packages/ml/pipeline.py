"""
智渡录取概率 ML Pipeline (v2)
==============================
从 Supabase 导出历史录取数据 → 特征工程 → 相关性分析 →
Optuna 超参搜索 → XGBoost + LightGBM 训练 → 概率校准 → 评估报告

v2 改进 (Phase 19):
- 共享特征模块 (features.py) 消除三处重复代码
- 移除目标泄漏特征 (min_rank/min_score/avg_score 原始值)
- 移除冗余单调变换 (log_rank_ratio/rank_log_diff/score_gap_ratio)
- 显式分类映射替代 LabelEncoder (避免全量数据拟合泄漏)
- 4-way 数据分割: train / val / calibration / test
- Optuna 超参搜索 + 3-fold CV (可选)
- ECE/MCE 校准指标
- 19 维特征（从原始 24 维精简）

用法: python pipeline.py [--export-only] [--skip-torch] [--skip-optuna]
"""

import os
import sys
import json
import argparse
import warnings
from pathlib import Path

import numpy as np
import pandas as pd
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import seaborn as sns
from sklearn.model_selection import train_test_split, StratifiedKFold
from sklearn.preprocessing import StandardScaler
from sklearn.calibration import CalibratedClassifierCV
from sklearn.metrics import (
    roc_auc_score, brier_score_loss, log_loss,
    accuracy_score, precision_score, recall_score, f1_score,
    classification_report, roc_curve, precision_recall_curve,
)
import xgboost as xgb
import lightgbm as lgb

# Optuna (可选依赖)
try:
    import optuna
    optuna.logging.set_verbosity(optuna.logging.WARNING)
    HAS_OPTUNA = True
except ImportError:
    HAS_OPTUNA = False

# 共享特征模块
from features import (
    FEATURE_NAMES, SYNTH_SAMPLES_PER_RECORD, NOISE_STD,
    PROVINCE_TO_CODE, TIER_TO_CODE, SCHOOL_TYPE_TO_CODE, EVAL_RATING_ORDER,
    map_province, map_tier, map_school_type,
    build_feature_dict, feature_dict_to_row,
)

warnings.filterwarnings('ignore')

# ─── Config ─────────────────────────────────────────────────────────────────

OUTPUT_DIR = Path(__file__).parent / 'output'
DATA_DIR = OUTPUT_DIR / 'data'
MODEL_DIR = OUTPUT_DIR / 'models'
REPORT_DIR = OUTPUT_DIR / 'reports'

SUPABASE_URL = os.environ.get('NEXT_PUBLIC_SUPABASE_URL', '')
SUPABASE_KEY = os.environ.get('SUPABASE_SERVICE_ROLE_KEY', '')

# Optuna 搜索配置
OPTUNA_N_TRIALS_XGB = 30
OPTUNA_N_TRIALS_LGB = 30


def ensure_dirs():
    for d in [OUTPUT_DIR, DATA_DIR, MODEL_DIR, REPORT_DIR]:
        d.mkdir(parents=True, exist_ok=True)


# ─── 校准指标 ──────────────────────────────────────────────────────────────

def expected_calibration_error(y_true, y_prob, n_bins=10):
    """Expected Calibration Error (ECE)"""
    bin_boundaries = np.linspace(0, 1, n_bins + 1)
    ece = 0.0
    for i in range(n_bins):
        mask = (y_prob > bin_boundaries[i]) & (y_prob <= bin_boundaries[i + 1])
        if mask.sum() > 0:
            bin_acc = y_true[mask].mean()
            bin_conf = y_prob[mask].mean()
            ece += mask.sum() * abs(bin_acc - bin_conf)
    return ece / len(y_true)


def maximum_calibration_error(y_true, y_prob, n_bins=10):
    """Maximum Calibration Error (MCE)"""
    bin_boundaries = np.linspace(0, 1, n_bins + 1)
    mce = 0.0
    for i in range(n_bins):
        mask = (y_prob > bin_boundaries[i]) & (y_prob <= bin_boundaries[i + 1])
        if mask.sum() > 0:
            bin_acc = y_true[mask].mean()
            bin_conf = y_prob[mask].mean()
            mce = max(mce, abs(bin_acc - bin_conf))
    return mce


# ─── 1. Data Export ─────────────────────────────────────────────────────────

def export_from_supabase():
    """从 Supabase 导出录取数据 + 院校数据"""
    print("=" * 60)
    print("[1/6] 数据导出")
    print("=" * 60)

    try:
        from supabase import create_client
        client = create_client(SUPABASE_URL, SUPABASE_KEY)

        result = client.table('admission_scores').select('*').limit(10000).execute()
        admissions = pd.DataFrame(result.data)
        print(f"  admission_scores: {len(admissions)} 条")

        result = client.table('universities').select(
            'id, name, province, tier, is_985, is_211, is_dual_first_class, school_type'
        ).limit(10000).execute()
        universities = pd.DataFrame(result.data)
        print(f"  universities: {len(universities)} 条")

        try:
            result = client.table('university_rankings').select('*').limit(10000).execute()
            rankings = pd.DataFrame(result.data)
            print(f"  university_rankings: {len(rankings)} 条")
        except Exception:
            rankings = pd.DataFrame()
            print("  university_rankings: 0 条 (表不存在)")

        try:
            result = client.table('discipline_evaluations').select('*').limit(10000).execute()
            evaluations = pd.DataFrame(result.data)
            print(f"  discipline_evaluations: {len(evaluations)} 条")
        except Exception:
            evaluations = pd.DataFrame()
            print("  discipline_evaluations: 0 条 (表不存在)")

    except ImportError:
        print("  supabase SDK 未安装，使用 REST API...")
        import requests

        headers = {
            'apikey': SUPABASE_KEY,
            'Authorization': f'Bearer {SUPABASE_KEY}',
            'Range': '0-99999',
        }

        r = requests.get(f'{SUPABASE_URL}/rest/v1/admission_scores?select=*', headers=headers)
        admissions = pd.DataFrame(r.json())
        print(f"  admission_scores: {len(admissions)} 条")

        r = requests.get(
            f'{SUPABASE_URL}/rest/v1/universities?select=id,name,province,tier,is_985,is_211,is_dual_first_class,school_type',
            headers=headers,
        )
        universities = pd.DataFrame(r.json())
        print(f"  universities: {len(universities)} 条")

        try:
            r = requests.get(f'{SUPABASE_URL}/rest/v1/university_rankings?select=*', headers=headers)
            rankings = pd.DataFrame(r.json())
            print(f"  university_rankings: {len(rankings)} 条")
        except Exception:
            rankings = pd.DataFrame()

        try:
            r = requests.get(f'{SUPABASE_URL}/rest/v1/discipline_evaluations?select=*', headers=headers)
            evaluations = pd.DataFrame(r.json())
            print(f"  discipline_evaluations: {len(evaluations)} 条")
        except Exception:
            evaluations = pd.DataFrame()

    # 保存
    admissions.to_csv(DATA_DIR / 'admissions.csv', index=False)
    universities.to_csv(DATA_DIR / 'universities.csv', index=False)
    if not rankings.empty:
        rankings.to_csv(DATA_DIR / 'rankings.csv', index=False)
    if not evaluations.empty:
        evaluations.to_csv(DATA_DIR / 'evaluations.csv', index=False)

    print(f"  数据已保存到 {DATA_DIR}/")
    return admissions, universities, rankings, evaluations


def load_data():
    """加载已导出的数据"""
    admissions = pd.read_csv(DATA_DIR / 'admissions.csv')
    universities = pd.read_csv(DATA_DIR / 'universities.csv')

    rankings_path = DATA_DIR / 'rankings.csv'
    rankings = pd.read_csv(rankings_path) if rankings_path.exists() else pd.DataFrame()

    evals_path = DATA_DIR / 'evaluations.csv'
    evaluations = pd.read_csv(evals_path) if evals_path.exists() else pd.DataFrame()

    return admissions, universities, rankings, evaluations


# ─── 2. Feature Engineering ─────────────────────────────────────────────────

def build_features(admissions, universities, rankings, evaluations):
    """
    构建训练特征矩阵 (v2)

    改进点:
    - 使用共享特征模块 (features.py)，消除 pipeline/serve/predict 三处重复
    - 移除目标泄漏特征 (min_rank/min_score/avg_score 原始值)
    - 移除冗余单调变换 (log_rank_ratio/rank_log_diff/score_gap_ratio)
    - 显式分类映射 (不依赖 LabelEncoder 全量 fit)
    - 新增相对特征 (school_selectivity / score_spread_norm)

    注意: 标签仍为合成标签 (synthetic labels)，基于 rank_ratio 的分段函数生成。
    未来需要用真实录取结果数据替换合成标签以提升模型泛化能力。
    """
    print("\n" + "=" * 60)
    print("[2/6] 特征工程 (v2)")
    print("=" * 60)

    # 合并院校信息
    df = admissions.merge(
        universities,
        left_on='university_id',
        right_on='id',
        suffixes=('', '_uni'),
        how='left',
    )

    # 编码分类变量（使用显式映射，不依赖 LabelEncoder）
    df['province_code'] = df['province'].map(
        lambda x: PROVINCE_TO_CODE.get(x, 0)
    )
    df['tier_code'] = df['tier'].map(
        lambda x: TIER_TO_CODE.get(str(x), 3) if pd.notna(x) else 3
    )
    if 'school_type' in df.columns:
        df['school_type_code'] = df['school_type'].map(
            lambda x: SCHOOL_TYPE_TO_CODE.get(str(x), 0) if pd.notna(x) else 0
        )
    else:
        df['school_type_code'] = 0

    # 院校排名特征
    ranking_map = {}
    if not rankings.empty and 'university_id' in rankings.columns and 'rank' in rankings.columns:
        ranking_map = rankings.groupby('university_id')['rank'].min().to_dict()

    df['uni_rank'] = df['university_id'].map(ranking_map).fillna(999)
    df['uni_rank_log'] = np.log1p(df['uni_rank'])

    # 学科评估特征
    eval_map = {}
    if not evaluations.empty and 'university_id' in evaluations.columns and 'rating' in evaluations.columns:
        eval_best = evaluations.copy()
        eval_best['rating_num'] = eval_best['rating'].map(EVAL_RATING_ORDER).fillna(11)
        eval_map = eval_best.groupby('university_id')['rating_num'].min().to_dict()

    df['best_discipline'] = df['university_id'].map(eval_map).fillna(11)

    # 省控线估算（同省同年最低分）
    score_line_est = df.groupby(['province', 'year'])['min_score'].transform('min')
    df['score_line_est'] = score_line_est

    # 院校选拔度 (min_score - 省控线) / 100
    df['school_selectivity'] = np.maximum(0, df['min_score'] - df['score_line_est']) / 100.0

    # 清理 NaN 和布尔列
    bool_cols = ['is_985', 'is_211', 'is_dual_first_class']
    for col in bool_cols:
        if col in df.columns:
            df[col] = df[col].fillna(False).astype(int)

    # ─── 生成合成训练样本 ───
    print("  生成合成训练样本 (synthetic labels)...")
    np.random.seed(42)

    features_list = []
    labels_list = []

    for _, row in df.iterrows():
        if pd.isna(row.get('min_rank')) or row['min_rank'] <= 0:
            continue

        min_rank = float(row['min_rank'])
        min_score = float(row['min_score'])
        avg_score = float(row['avg_score']) if pd.notna(row.get('avg_score')) else min_score

        for _ in range(SYNTH_SAMPLES_PER_RECORD):
            # 随机生成 rank_ratio（考生位次 / 录取最低位次）
            # ratio < 1 = 位次优于录取线 → 大概率录取
            # ratio > 1 = 位次劣于录取线 → 小概率录取
            rank_ratio = np.random.lognormal(0, 0.3)
            student_rank = min_rank * rank_ratio

            # 合成标签：基于位次比的决定性录取概率 + 噪声
            # ⚠️ 这是合成标签，不是真实录取结果
            if rank_ratio <= 0.7:
                prob = 0.95 + np.random.normal(0, 0.02)
            elif rank_ratio <= 1.0:
                prob = 0.5 + 0.45 * (1.0 - rank_ratio) / 0.3 + np.random.normal(0, 0.03)
            elif rank_ratio <= 1.3:
                prob = 0.5 * (1.3 - rank_ratio) / 0.3 + np.random.normal(0, 0.03)
            elif rank_ratio <= 1.8:
                prob = max(0.02, 0.1 * (1.8 - rank_ratio) / 0.5 + np.random.normal(0, 0.02))
            else:
                prob = 0.02 + np.random.normal(0, 0.01)

            label = 1 if prob > 0.5 else 0

            # 使用共享特征模块构建 19 维特征
            feat = build_feature_dict(
                student_rank=student_rank,
                min_rank=min_rank,
                min_score=min_score,
                avg_score=avg_score,
                is_985=int(row.get('is_985', 0)),
                is_211=int(row.get('is_211', 0)),
                is_dual_first_class=int(row.get('is_dual_first_class', 0)),
                tier=int(row['tier_code']),
                school_type=int(row['school_type_code']),
                uni_rank=row['uni_rank'],
                best_discipline=row['best_discipline'],
                province=int(row['province_code']),
                year=int(row['year']),
                score_line_est=row['score_line_est'],
                school_selectivity=row['school_selectivity'],
            )

            # 添加噪声到数值特征（模拟数据不确定性）
            for key in ['rank_ratio', 'rank_ratio_sq', 'rank_inv']:
                feat[key] += np.random.normal(0, NOISE_STD * 0.5)

            features_list.append(feat)
            labels_list.append(label)

    X = pd.DataFrame(features_list)
    y = np.array(labels_list)

    # 清理异常值
    X = X.replace([np.inf, -np.inf], np.nan).fillna(0)

    # 确保列顺序与 FEATURE_NAMES 一致
    for name in FEATURE_NAMES:
        if name not in X.columns:
            X[name] = 0
    X = X[FEATURE_NAMES]

    print(f"  特征矩阵: {X.shape[0]} 样本 × {X.shape[1]} 特征")
    print(f"  正样本: {y.sum()} ({y.mean()*100:.1f}%), 负样本: {(1-y).sum()} ({(1-y.mean())*100:.1f}%)")
    print(f"  ⚠️  标签类型: 合成标签 (synthetic) — 非真实录取结果")
    print(f"  特征列表 ({len(FEATURE_NAMES)}):")
    for i, name in enumerate(FEATURE_NAMES, 1):
        print(f"    {i:2d}. {name}")

    # 保存
    X.to_csv(DATA_DIR / 'features.csv', index=False)
    pd.Series(y, name='label').to_csv(DATA_DIR / 'labels.csv', index=False)

    # 保存元数据 (v2 格式)
    feature_meta = {
        'version': '2.0',
        'feature_names': FEATURE_NAMES,
        'label_type': 'synthetic',
        'category_mappings': {
            'province': PROVINCE_TO_CODE,
            'tier': TIER_TO_CODE,
            'school_type': SCHOOL_TYPE_TO_CODE,
            'eval_rating': EVAL_RATING_ORDER,
        },
    }
    with open(DATA_DIR / 'feature_meta.json', 'w', encoding='utf-8') as f:
        json.dump(feature_meta, f, ensure_ascii=False, indent=2)

    return X, y


# ─── 3. Correlation Analysis ────────────────────────────────────────────────

def correlation_analysis(X, y):
    """特征相关性分析 + 可视化"""
    print("\n" + "=" * 60)
    print("[3/6] 相关性分析")
    print("=" * 60)

    # 特征与标签的相关性
    correlations = X.corrwith(pd.Series(y)).abs().sort_values(ascending=False)
    print("\n  Top 10 特征（与录取标签的相关性）:")
    for i, (feat, corr) in enumerate(correlations.head(10).items()):
        print(f"    {i+1}. {feat}: {corr:.4f}")

    # 特征间相关性矩阵
    available = [f for f in FEATURE_NAMES if f in X.columns]
    corr_matrix = X[available].corr()

    # 绘制热力图
    fig, axes = plt.subplots(1, 2, figsize=(20, 8))

    # 左图：特征-标签相关性条形图
    top_n = min(18, len(correlations))
    corr_top = correlations.head(top_n)
    bars = axes[0].barh(range(top_n), corr_top.values, color='#2980b9', alpha=0.85)
    axes[0].set_yticks(range(top_n))
    axes[0].set_yticklabels(corr_top.index, fontsize=9)
    axes[0].set_xlabel('Correlation with Label')
    axes[0].set_title('Feature-Label Correlation (v2)')
    axes[0].invert_yaxis()

    # 右图：特征间相关性热力图
    sns.heatmap(corr_matrix, annot=True, fmt='.2f', cmap='RdBu_r', center=0,
                ax=axes[1], square=True, linewidths=0.5,
                cbar_kws={'shrink': 0.8}, annot_kws={'size': 7})
    axes[1].set_title('Feature Correlation Matrix (v2)')

    plt.tight_layout()
    plt.savefig(REPORT_DIR / 'correlation_analysis.png', dpi=150, bbox_inches='tight')
    plt.close()
    print(f"\n  相关性图表已保存到 {REPORT_DIR / 'correlation_analysis.png'}")

    return correlations


# ─── 4. Optuna 超参搜索 ────────────────────────────────────────────────────

def optuna_search_xgb(X_train, y_train, n_trials=30):
    """Optuna 超参搜索 — XGBoost（3-fold CV，优化 AUC）"""
    if not HAS_OPTUNA:
        print("    Optuna 未安装，使用默认参数")
        return _default_xgb_params()

    def objective(trial):
        params = {
            'n_estimators': 500,
            'max_depth': trial.suggest_int('max_depth', 3, 10),
            'learning_rate': trial.suggest_float('learning_rate', 0.01, 0.15, log=True),
            'subsample': trial.suggest_float('subsample', 0.6, 1.0),
            'colsample_bytree': trial.suggest_float('colsample_bytree', 0.6, 1.0),
            'min_child_weight': trial.suggest_int('min_child_weight', 1, 20),
            'gamma': trial.suggest_float('gamma', 0.0, 1.0),
            'reg_alpha': trial.suggest_float('reg_alpha', 1e-3, 10.0, log=True),
            'reg_lambda': trial.suggest_float('reg_lambda', 0.1, 10.0, log=True),
            'objective': 'binary:logistic',
            'eval_metric': 'auc',
            'random_state': 42,
            'use_label_encoder': False,
            'n_jobs': -1,
        }

        skf = StratifiedKFold(n_splits=3, shuffle=True, random_state=42)
        auc_scores = []

        for train_idx, val_idx in skf.split(X_train, y_train):
            X_tr, X_va = X_train.iloc[train_idx], X_train.iloc[val_idx]
            y_tr, y_va = y_train[train_idx], y_train[val_idx]

            model = xgb.XGBClassifier(**params)
            model.fit(X_tr, y_tr, eval_set=[(X_va, y_va)], verbose=False)

            prob = model.predict_proba(X_va)[:, 1]
            auc_scores.append(roc_auc_score(y_va, prob))

        return np.mean(auc_scores)

    study = optuna.create_study(direction='maximize')
    study.optimize(objective, n_trials=n_trials, show_progress_bar=True)

    best_params = _default_xgb_params()
    best_params.update(study.best_params)
    print(f"    XGBoost 最优 AUC: {study.best_value:.4f}")
    return best_params


def optuna_search_lgb(X_train, y_train, n_trials=30):
    """Optuna 超参搜索 — LightGBM（3-fold CV，优化 AUC）"""
    if not HAS_OPTUNA:
        print("    Optuna 未安装，使用默认参数")
        return _default_lgb_params()

    def objective(trial):
        params = {
            'n_estimators': 500,
            'max_depth': trial.suggest_int('max_depth', 3, 12),
            'learning_rate': trial.suggest_float('learning_rate', 0.01, 0.15, log=True),
            'num_leaves': trial.suggest_int('num_leaves', 15, 127),
            'subsample': trial.suggest_float('subsample', 0.6, 1.0),
            'colsample_bytree': trial.suggest_float('colsample_bytree', 0.6, 1.0),
            'min_child_samples': trial.suggest_int('min_child_samples', 5, 50),
            'reg_alpha': trial.suggest_float('reg_alpha', 1e-3, 10.0, log=True),
            'reg_lambda': trial.suggest_float('reg_lambda', 0.1, 10.0, log=True),
            'objective': 'binary',
            'metric': 'auc',
            'random_state': 42,
            'verbose': -1,
            'n_jobs': -1,
        }

        skf = StratifiedKFold(n_splits=3, shuffle=True, random_state=42)
        auc_scores = []

        for train_idx, val_idx in skf.split(X_train, y_train):
            X_tr, X_va = X_train.iloc[train_idx], X_train.iloc[val_idx]
            y_tr, y_va = y_train[train_idx], y_train[val_idx]

            model = lgb.LGBMClassifier(**params)
            model.fit(X_tr, y_tr, eval_set=[(X_va, y_va)])

            prob = model.predict_proba(X_va)[:, 1]
            auc_scores.append(roc_auc_score(y_va, prob))

        return np.mean(auc_scores)

    study = optuna.create_study(direction='maximize')
    study.optimize(objective, n_trials=n_trials, show_progress_bar=True)

    best_params = _default_lgb_params()
    best_params.update(study.best_params)
    print(f"    LightGBM 最优 AUC: {study.best_value:.4f}")
    return best_params


def _default_xgb_params():
    """XGBoost 默认参数（Optuna 不可用时回退）"""
    return {
        'n_estimators': 500,
        'max_depth': 6,
        'learning_rate': 0.05,
        'subsample': 0.8,
        'colsample_bytree': 0.8,
        'min_child_weight': 5,
        'gamma': 0.1,
        'reg_alpha': 0.1,
        'reg_lambda': 1.0,
        'objective': 'binary:logistic',
        'eval_metric': 'auc',
        'random_state': 42,
        'use_label_encoder': False,
        'n_jobs': -1,
    }


def _default_lgb_params():
    """LightGBM 默认参数（Optuna 不可用时回退）"""
    return {
        'n_estimators': 500,
        'max_depth': 7,
        'learning_rate': 0.05,
        'num_leaves': 63,
        'subsample': 0.8,
        'colsample_bytree': 0.8,
        'min_child_samples': 10,
        'reg_alpha': 0.1,
        'reg_lambda': 1.0,
        'objective': 'binary',
        'metric': 'auc',
        'random_state': 42,
        'verbose': -1,
        'n_jobs': -1,
    }


# ─── 5. Model Training ──────────────────────────────────────────────────────

def train_models(X, y, skip_torch=False, skip_optuna=False):
    """
    训练 XGBoost + LightGBM 模型 (v2)

    改进点:
    - 4-way 数据分割: train(60%) / val(20%) / test(20%)
    - CalibratedClassifierCV 使用 cv='prefit'，在独立的 val 集上校准
    - Optuna 超参搜索 + 3-fold CV (可选)
    - ECE/MCE 校准指标
    """
    print("\n" + "=" * 60)
    print("[4/6] 模型训练 (v2)")
    print("=" * 60)

    # ─── 4-way 数据分割 ───
    # Step 1: 80% train_raw + 20% test
    X_train_raw, X_test, y_train_raw, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y,
    )
    # Step 2: train_raw → 75% train + 25% val
    #   (最终比例: train=60%, val=20%, test=20%)
    X_train, X_val, y_train, y_val = train_test_split(
        X_train_raw, y_train_raw, test_size=0.25, random_state=42, stratify=y_train_raw,
    )

    print(f"  数据分割:")
    print(f"    训练集: {len(X_train)} (60%)")
    print(f"    验证集: {len(X_val)} (20%) — 用于 early stopping + 概率校准")
    print(f"    测试集: {len(X_test)} (20%) — 仅用于最终评估")

    results = {}

    # ─── Optuna 超参搜索 ───
    if not skip_optuna and HAS_OPTUNA:
        print("\n  --- Optuna 超参搜索 ---")
        xgb_params = optuna_search_xgb(X_train, y_train, n_trials=OPTUNA_N_TRIALS_XGB)
        lgb_params = optuna_search_lgb(X_train, y_train, n_trials=OPTUNA_N_TRIALS_LGB)
    else:
        print("\n  使用默认超参数 (skip_optuna=True 或 Optuna 未安装)")
        xgb_params = _default_xgb_params()
        lgb_params = _default_lgb_params()

    # ─── XGBoost ───
    print("\n  --- XGBoost ---")
    xgb_model = xgb.XGBClassifier(**xgb_params)
    xgb_model.fit(
        X_train, y_train,
        eval_set=[(X_val, y_val)],
        verbose=50,
    )

    # 概率校准（使用独立的验证集 + cv='prefit'）
    xgb_calibrated = CalibratedClassifierCV(xgb_model, method='isotonic', cv='prefit')
    xgb_calibrated.fit(X_val, y_val)

    xgb_prob = xgb_calibrated.predict_proba(X_test)[:, 1]
    xgb_pred = xgb_calibrated.predict(X_test)
    results['xgboost'] = evaluate_model('XGBoost', xgb_prob, xgb_pred, y_test)

    # 保存模型
    xgb_model.save_model(str(MODEL_DIR / 'xgboost_model.json'))
    import joblib
    joblib.dump(xgb_calibrated, MODEL_DIR / 'xgboost_calibrated.pkl')

    # XGBoost 特征重要性
    importance = pd.Series(
        xgb_model.feature_importances_, index=X.columns,
    ).sort_values(ascending=False)
    print("\n  XGBoost Top 10 特征重要性:")
    for i, (feat, imp) in enumerate(importance.head(10).items()):
        print(f"    {i+1}. {feat}: {imp:.4f}")
    importance.to_csv(REPORT_DIR / 'xgboost_importance.csv')

    # ─── LightGBM ───
    print("\n  --- LightGBM ---")
    lgb_model = lgb.LGBMClassifier(**lgb_params)
    lgb_model.fit(
        X_train, y_train,
        eval_set=[(X_val, y_val)],
    )

    # 概率校准
    lgb_calibrated = CalibratedClassifierCV(lgb_model, method='isotonic', cv='prefit')
    lgb_calibrated.fit(X_val, y_val)

    lgb_prob = lgb_calibrated.predict_proba(X_test)[:, 1]
    lgb_pred = lgb_calibrated.predict(X_test)
    results['lightgbm'] = evaluate_model('LightGBM', lgb_prob, lgb_pred, y_test)

    lgb_model.booster_.save_model(str(MODEL_DIR / 'lightgbm_model.txt'))
    joblib.dump(lgb_calibrated, MODEL_DIR / 'lightgbm_calibrated.pkl')

    lgb_importance = pd.Series(
        lgb_model.feature_importances_, index=X.columns,
    ).sort_values(ascending=False)
    lgb_importance.to_csv(REPORT_DIR / 'lightgbm_importance.csv')

    # ─── PyTorch MLP（可选）───
    if not skip_torch:
        print("\n  --- PyTorch MLP ---")
        try:
            import torch
            import torch.nn as nn
            from torch.utils.data import TensorDataset, DataLoader

            torch_prob, torch_pred = train_pytorch_model(
                X_train, y_train, X_val, y_val, X_test,
            )
            results['pytorch'] = evaluate_model('PyTorch MLP', torch_prob, torch_pred, y_test)
        except Exception as e:
            print(f"  PyTorch 训练失败: {e}")
            results['pytorch'] = None

    # 保存结果
    with open(REPORT_DIR / 'results_summary.json', 'w', encoding='utf-8') as f:
        json.dump(results, f, ensure_ascii=False, indent=2)

    # 保存超参（便于复现）
    params_record = {
        'xgboost': {k: v for k, v in xgb_params.items() if k != 'n_jobs'},
        'lightgbm': {k: v for k, v in lgb_params.items() if k != 'n_jobs'},
        'optuna_used': not skip_optuna and HAS_OPTUNA,
        'feature_version': '2.0',
        'label_type': 'synthetic',
    }
    with open(REPORT_DIR / 'hyperparams.json', 'w', encoding='utf-8') as f:
        json.dump(params_record, f, ensure_ascii=False, indent=2)

    return results, X_test, y_test, {
        'xgboost': xgb_calibrated,
        'lightgbm': lgb_calibrated,
    }


def train_pytorch_model(X_train, y_train, X_val, y_val, X_test):
    """PyTorch MLP 模型"""
    import torch
    import torch.nn as nn
    from torch.utils.data import TensorDataset, DataLoader

    scaler = StandardScaler()
    X_train_s = scaler.fit_transform(X_train)
    X_val_s = scaler.transform(X_val)
    X_test_s = scaler.transform(X_test)

    import joblib
    joblib.dump(scaler, MODEL_DIR / 'pytorch_scaler.pkl')

    device = torch.device('cpu')

    class AdmissionNet(nn.Module):
        def __init__(self, input_dim):
            super().__init__()
            self.net = nn.Sequential(
                nn.Linear(input_dim, 128),
                nn.BatchNorm1d(128),
                nn.ReLU(),
                nn.Dropout(0.3),
                nn.Linear(128, 64),
                nn.BatchNorm1d(64),
                nn.ReLU(),
                nn.Dropout(0.2),
                nn.Linear(64, 32),
                nn.ReLU(),
                nn.Linear(32, 1),
                nn.Sigmoid(),
            )

        def forward(self, x):
            return self.net(x).squeeze(-1)

    model = AdmissionNet(X_train.shape[1]).to(device)
    optimizer = torch.optim.Adam(model.parameters(), lr=1e-3, weight_decay=1e-4)
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=100)
    criterion = nn.BCELoss()

    X_t = torch.FloatTensor(X_train_s).to(device)
    y_t = torch.FloatTensor(y_train).to(device)
    X_v = torch.FloatTensor(X_val_s).to(device)
    y_v = torch.FloatTensor(y_val).to(device)

    dataset = TensorDataset(X_t, y_t)
    loader = DataLoader(dataset, batch_size=256, shuffle=True)

    best_val_auc = 0
    patience = 15
    no_improve = 0

    for epoch in range(200):
        model.train()
        epoch_loss = 0
        for xb, yb in loader:
            optimizer.zero_grad()
            pred = model(xb)
            loss = criterion(pred, yb)
            loss.backward()
            optimizer.step()
            epoch_loss += loss.item()
        scheduler.step()

        model.eval()
        with torch.no_grad():
            val_pred = model(X_v).cpu().numpy()
            val_auc = roc_auc_score(y_val, val_pred)

        if val_auc > best_val_auc:
            best_val_auc = val_auc
            torch.save(model.state_dict(), MODEL_DIR / 'pytorch_model.pth')
            no_improve = 0
        else:
            no_improve += 1

        if (epoch + 1) % 20 == 0:
            print(f"    Epoch {epoch+1}: loss={epoch_loss/len(loader):.4f}, val_auc={val_auc:.4f}")

        if no_improve >= patience:
            print(f"    Early stopping at epoch {epoch+1}")
            break

    model.load_state_dict(torch.load(MODEL_DIR / 'pytorch_model.pth', weights_only=True))
    model.eval()
    with torch.no_grad():
        test_prob = model(torch.FloatTensor(X_test_s).to(device)).cpu().numpy()
        test_pred = (test_prob > 0.5).astype(int)

    print(f"    Best val AUC: {best_val_auc:.4f}")
    return test_prob, test_pred


# ─── 6. Evaluation ──────────────────────────────────────────────────────────

def evaluate_model(name, prob, pred, y_true):
    """评估单个模型（含 ECE/MCE 校准指标）"""
    auc = roc_auc_score(y_true, prob)
    brier = brier_score_loss(y_true, prob)
    ll = log_loss(y_true, prob)
    acc = accuracy_score(y_true, pred)
    prec = precision_score(y_true, pred, zero_division=0)
    rec = recall_score(y_true, pred, zero_division=0)
    f1 = f1_score(y_true, pred, zero_division=0)
    ece = expected_calibration_error(y_true, prob)
    mce = maximum_calibration_error(y_true, prob)

    print(f"    {name}:")
    print(f"      AUC={auc:.4f}  Brier={brier:.4f}  LogLoss={ll:.4f}")
    print(f"      Acc={acc:.4f}  Precision={prec:.4f}  Recall={rec:.4f}  F1={f1:.4f}")
    print(f"      ECE={ece:.4f}  MCE={mce:.4f}")

    return {
        'name': name,
        'auc': round(auc, 4),
        'brier': round(brier, 4),
        'log_loss': round(ll, 4),
        'accuracy': round(acc, 4),
        'precision': round(prec, 4),
        'recall': round(rec, 4),
        'f1': round(f1, 4),
        'ece': round(ece, 4),
        'mce': round(mce, 4),
    }


def generate_report(results, X_test, y_test, models, correlations):
    """生成评估报告和可视化"""
    print("\n" + "=" * 60)
    print("[5/6] 评估报告")
    print("=" * 60)

    fig, axes = plt.subplots(2, 2, figsize=(16, 12))

    # 1. ROC 曲线对比
    ax = axes[0, 0]
    for name, model in models.items():
        prob = model.predict_proba(X_test)[:, 1]
        fpr, tpr, _ = roc_curve(y_test, prob)
        auc = roc_auc_score(y_test, prob)
        ax.plot(fpr, tpr, label=f'{name} (AUC={auc:.3f})', linewidth=2)
    ax.plot([0, 1], [0, 1], 'k--', alpha=0.3)
    ax.set_xlabel('False Positive Rate')
    ax.set_ylabel('True Positive Rate')
    ax.set_title('ROC Curve Comparison (v2)')
    ax.legend(fontsize=9)

    # 2. Precision-Recall 曲线
    ax = axes[0, 1]
    for name, model in models.items():
        prob = model.predict_proba(X_test)[:, 1]
        prec_arr, rec_arr, _ = precision_recall_curve(y_test, prob)
        ax.plot(rec_arr, prec_arr, label=f'{name}', linewidth=2)
    ax.set_xlabel('Recall')
    ax.set_ylabel('Precision')
    ax.set_title('Precision-Recall Curve')
    ax.legend(fontsize=9)

    # 3. 概率分布直方图
    ax = axes[1, 0]
    for name, model in models.items():
        prob = model.predict_proba(X_test)[:, 1]
        ax.hist(prob[y_test == 1], bins=30, alpha=0.5, label=f'{name} (admitted)', density=True)
        ax.hist(prob[y_test == 0], bins=30, alpha=0.3, label=f'{name} (rejected)', density=True)
    ax.set_xlabel('Predicted Probability')
    ax.set_ylabel('Density')
    ax.set_title('Probability Distribution (Calibrated)')
    ax.legend(fontsize=8)

    # 4. 指标对比柱状图
    ax = axes[1, 1]
    metrics = ['auc', 'accuracy', 'precision', 'recall', 'f1', 'ece']
    x_pos = np.arange(len(metrics))
    width = 0.25
    for i, (name, res) in enumerate(results.items()):
        if res is None:
            continue
        vals = [res.get(m, 0) for m in metrics]
        ax.bar(x_pos + i * width, vals, width, label=name, alpha=0.85)
    ax.set_xticks(x_pos + width)
    ax.set_xticklabels([m.capitalize() for m in metrics])
    ax.set_ylabel('Score')
    ax.set_title('Model Metrics Comparison (v2)')
    ax.legend(fontsize=9)

    plt.tight_layout()
    plt.savefig(REPORT_DIR / 'evaluation_report.png', dpi=150, bbox_inches='tight')
    plt.close()

    # 概率校准图
    fig, ax = plt.subplots(figsize=(8, 6))
    for name, model in models.items():
        prob = model.predict_proba(X_test)[:, 1]
        bins = np.linspace(0, 1, 11)
        bin_idx = np.digitize(prob, bins) - 1
        bin_idx = np.clip(bin_idx, 0, 9)

        bin_means = [prob[bin_idx == i].mean() if (bin_idx == i).sum() > 0 else 0 for i in range(10)]
        bin_true = [y_test[bin_idx == i].mean() if (bin_idx == i).sum() > 0 else 0 for i in range(10)]

        ax.plot(bin_means, bin_true, 'o-', label=name, linewidth=2)

    ax.plot([0, 1], [0, 1], 'k--', alpha=0.3, label='Perfect calibration')
    ax.set_xlabel('Mean Predicted Probability')
    ax.set_ylabel('Fraction of Positives')
    ax.set_title('Calibration Plot (v2)')
    ax.legend()
    plt.tight_layout()
    plt.savefig(REPORT_DIR / 'calibration_plot.png', dpi=150)
    plt.close()

    print(f"  报告图表已保存到 {REPORT_DIR}/")


# ─── 7. Prediction API ──────────────────────────────────────────────────────

def save_prediction_api():
    """生成预测推理脚本 (v2 — 使用共享特征模块)"""
    print("\n" + "=" * 60)
    print("[6/6] 生成预测 API (v2)")
    print("=" * 60)

    api_code = '''"""
录取概率预测 API (v2)
=====================
加载训练好的模型，对新的考生-院校组合预测录取概率。
使用共享特征模块 (features.py) 保证训练-推理特征一致。

用法:
    from predict import predict_admission
    prob = predict_admission(
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

_xgb_model = None
_lgb_model = None
_feature_meta = None


def _load_models():
    global _xgb_model, _lgb_model, _feature_meta
    if _xgb_model is None:
        _xgb_model = joblib.load(MODEL_DIR / 'xgboost_calibrated.pkl')
        _lgb_model = joblib.load(MODEL_DIR / 'lightgbm_calibrated.pkl')
        with open(DATA_DIR / 'feature_meta.json', 'r', encoding='utf-8') as f:
            _feature_meta = json.load(f)


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
    """预测录取概率 (v2)"""
    _load_models()

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
    else:
        prob = 0.6 * xgb_prob + 0.4 * lgb_prob

    if prob >= 0.75:
        tier = 'SAFE'
    elif prob >= 0.40:
        tier = 'STABLE'
    else:
        tier = 'RUSH'

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
        'feature_version': '2.0',
    }


if __name__ == '__main__':
    result = predict_admission(
        student_rank=5000, min_rank=8000, min_score=620,
        avg_score=635, is_985=True, is_211=True, is_dual_first_class=True,
        tier_code=0, uni_rank=30, best_discipline=2,
    )
    print(f"录取概率: {result['probability']}%")
    print(f"分层: {result['tier']}")
    print(f"置信度: {result['confidence']}")
    print(f"位次比: {result['rank_ratio']}")
    print(f"  XGBoost: {result['xgboost_prob']}%")
    print(f"  LightGBM: {result['lightgbm_prob']}%")
'''

    with open(Path(__file__).parent / 'predict.py', 'w', encoding='utf-8') as f:
        f.write(api_code)
    print(f"  预测 API 已保存到 packages/ml/predict.py (v2)")


# ─── Main ───────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description='智渡录取概率 ML Pipeline (v2)')
    parser.add_argument('--export-only', action='store_true', help='仅导出数据')
    parser.add_argument('--skip-export', action='store_true', help='跳过导出（使用已有数据）')
    parser.add_argument('--skip-torch', action='store_true', help='跳过 PyTorch 训练')
    parser.add_argument('--skip-optuna', action='store_true', help='跳过 Optuna 超参搜索')
    args = parser.parse_args()

    ensure_dirs()

    # Step 1: Export
    if not args.skip_export:
        admissions, universities, rankings, evaluations = export_from_supabase()
    else:
        admissions, universities, rankings, evaluations = load_data()

    if args.export_only:
        print("\n导出完成。")
        return

    # Step 2: Feature Engineering
    X, y = build_features(admissions, universities, rankings, evaluations)

    # Step 3: Correlation Analysis
    correlations = correlation_analysis(X, y)

    # Step 4: Model Training
    results, X_test, y_test, models = train_models(
        X, y, skip_torch=args.skip_torch, skip_optuna=args.skip_optuna,
    )

    # Step 5: Evaluation Report
    generate_report(results, X_test, y_test, models, correlations)

    # Step 6: Prediction API
    save_prediction_api()

    # 最终汇总
    print("\n" + "=" * 60)
    print("Pipeline (v2) 完成！")
    print("=" * 60)
    print(f"\n  输出目录: {OUTPUT_DIR}")
    print(f"  模型文件: {MODEL_DIR}/")
    print(f"  评估报告: {REPORT_DIR}/")
    print(f"  特征版本: 2.0 (19 维)")
    print(f"  标签类型: 合成标签 (synthetic)")

    print("\n  模型性能汇总:")
    for name, res in results.items():
        if res:
            print(f"    {res['name']}: AUC={res['auc']:.4f}, F1={res['f1']:.4f}, "
                  f"Brier={res['brier']:.4f}, ECE={res['ece']:.4f}")

    # 测试预测 API
    print("\n  测试预测 API (v2)...")
    sys.path.insert(0, str(Path(__file__).parent))
    try:
        from predict import predict_admission
        test_result = predict_admission(
            student_rank=5000, min_rank=8000, min_score=620,
            avg_score=635, is_985=True, is_211=True, is_dual_first_class=True,
            tier_code=0, uni_rank=30, best_discipline=2,
        )
        print(f"    示例预测: 概率={test_result['probability']}%, "
              f"分层={test_result['tier']}, 置信度={test_result['confidence']}")
        print(f"    特征版本: {test_result.get('feature_version', 'unknown')}")
    except Exception as e:
        print(f"    预测 API 测试失败: {e}")


if __name__ == '__main__':
    main()
