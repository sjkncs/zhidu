"""
智渡录取概率 ML Pipeline
========================
从 Supabase 导出历史录取数据 → 特征工程 → 相关性分析 →
XGBoost + LightGBM + PyTorch 模型训练 → 概率校准 → 评估报告

用法: python pipeline.py [--export-only] [--skip-torch]
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
from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.calibration import CalibratedClassifierCV
from sklearn.metrics import (
    roc_auc_score, brier_score_loss, log_loss,
    accuracy_score, precision_score, recall_score, f1_score,
    classification_report, roc_curve, precision_recall_curve,
)
import xgboost as xgb
import lightgbm as lgb

warnings.filterwarnings('ignore')

# ─── Config ─────────────────────────────────────────────────────────────────

OUTPUT_DIR = Path(__file__).parent / 'output'
DATA_DIR = OUTPUT_DIR / 'data'
MODEL_DIR = OUTPUT_DIR / 'models'
REPORT_DIR = OUTPUT_DIR / 'reports'

SUPABASE_URL = os.environ.get('NEXT_PUBLIC_SUPABASE_URL', '')
SUPABASE_KEY = os.environ.get('SUPABASE_SERVICE_ROLE_KEY', '')

# 特征权重（用于 synthetic label generation）
SYNTH_SAMPLES_PER_RECORD = 8  # 每条历史记录生成多少个训练样本
NOISE_STD = 0.05  # 噪声标准差（位次比）


def ensure_dirs():
    for d in [OUTPUT_DIR, DATA_DIR, MODEL_DIR, REPORT_DIR]:
        d.mkdir(parents=True, exist_ok=True)


# ─── 1. Data Export ─────────────────────────────────────────────────────────

def export_from_supabase():
    """从 Supabase 导出录取数据 + 院校数据"""
    print("=" * 60)
    print("[1/6] 数据导出")
    print("=" * 60)

    try:
        from supabase import create_client
        client = create_client(SUPABASE_URL, SUPABASE_KEY)

        # 录取数据
        result = client.table('admission_scores').select('*').limit(10000).execute()
        admissions = pd.DataFrame(result.data)
        print(f"  admission_scores: {len(admissions)} 条")

        # 院校数据
        result = client.table('universities').select('id, name, province, tier, is_985, is_211, is_dual_first_class, school_type').limit(10000).execute()
        universities = pd.DataFrame(result.data)
        print(f"  universities: {len(universities)} 条")

        # 排名数据
        try:
            result = client.table('university_rankings').select('*').limit(10000).execute()
            rankings = pd.DataFrame(result.data)
            print(f"  university_rankings: {len(rankings)} 条")
        except Exception:
            rankings = pd.DataFrame()
            print("  university_rankings: 0 条 (表不存在)")

        # 学科评估
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

        # 录取数据
        r = requests.get(f'{SUPABASE_URL}/rest/v1/admission_scores?select=*', headers=headers)
        admissions = pd.DataFrame(r.json())
        print(f"  admission_scores: {len(admissions)} 条")

        # 院校数据
        r = requests.get(f'{SUPABASE_URL}/rest/v1/universities?select=id,name,province,tier,is_985,is_211,is_dual_first_class,school_type', headers=headers)
        universities = pd.DataFrame(r.json())
        print(f"  universities: {len(universities)} 条")

        # 排名
        try:
            r = requests.get(f'{SUPABASE_URL}/rest/v1/university_rankings?select=*', headers=headers)
            rankings = pd.DataFrame(r.json())
            print(f"  university_rankings: {len(rankings)} 条")
        except Exception:
            rankings = pd.DataFrame()

        # 学科评估
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
    构建训练特征矩阵

    核心思路：为每条历史录取记录生成多个合成样本，
    模拟不同位次比的考生，用录取结果作为标签。
    """
    print("\n" + "=" * 60)
    print("[2/6] 特征工程")
    print("=" * 60)

    # 合并院校信息
    df = admissions.merge(
        universities,
        left_on='university_id',
        right_on='id',
        suffixes=('', '_uni'),
        how='left'
    )

    # 编码分类变量
    le_province = LabelEncoder()
    df['province_code'] = le_province.fit_transform(df['province'])

    le_tier = LabelEncoder()
    tier_fill = df['tier'].fillna('普通本科')
    df['tier_code'] = le_tier.fit_transform(tier_fill)

    le_school_type = LabelEncoder()
    stype_fill = df['school_type'].fillna('综合') if 'school_type' in df.columns else pd.Series(['综合'] * len(df))
    df['school_type_code'] = le_school_type.fit_transform(stype_fill)

    # 院校排名特征
    ranking_map = {}
    if not rankings.empty and 'university_id' in rankings.columns and 'rank' in rankings.columns:
        best_ranks = rankings.groupby('university_id')['rank'].min().to_dict()
        ranking_map = best_ranks

    df['uni_rank'] = df['university_id'].map(ranking_map).fillna(999)
    df['uni_rank_log'] = np.log1p(df['uni_rank'])

    # 学科评估特征
    eval_map = {}
    if not evaluations.empty and 'university_id' in evaluations.columns:
        rating_order = {'A+': 1, 'A': 2, 'A-': 3, 'B+': 4, 'B': 5, 'B-': 6, 'C+': 7, 'C': 8, 'C-': 9, 'D': 10}
        eval_best = evaluations.copy()
        if 'rating' in eval_best.columns:
            eval_best['rating_num'] = eval_best['rating'].map(rating_order).fillna(11)
            eval_best = eval_best.groupby('university_id')['rating_num'].min().to_dict()
            eval_map = eval_best

    df['best_discipline'] = df['university_id'].map(eval_map).fillna(11)

    # 省控线估算（用同省同年最低分近似）
    score_line_est = df.groupby(['province', 'year'])['min_score'].transform('min')
    df['score_line_est'] = score_line_est

    # ─── 生成合成训练样本 ───
    # 清理 NaN 和布尔列
    bool_cols = ['is_985', 'is_211', 'is_dual_first_class']
    for col in bool_cols:
        if col in df.columns:
            df[col] = df[col].fillna(False).astype(int)

    print("  生成合成训练样本...")
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
            # 随机生成 rank_ratio (考生位次 / 录取最低位次)
            # ratio < 1 = 位次优于录取线 → 大概率录取
            # ratio > 1 = 位次劣于录取线 → 小概率录取
            rank_ratio = np.random.lognormal(0, 0.3)
            student_rank = min_rank * rank_ratio

            # 标签：基于位次比的决定性录取概率 + 噪声
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

            # 线差特征
            line_diff_est = (min_score - row['score_line_est']) if row['score_line_est'] > 0 else 0
            student_line_diff = (min_score * (1 + (rank_ratio - 1) * 0.5)) - row['score_line_est'] if row['score_line_est'] > 0 else 0

            features_list.append({
                # 核心特征
                'rank_ratio': rank_ratio + np.random.normal(0, NOISE_STD),
                'log_rank_ratio': np.log(rank_ratio + 1e-6) + np.random.normal(0, NOISE_STD * 0.5),
                'score_gap_ratio': (rank_ratio - 1.0),

                # 位次特征
                'student_rank': student_rank,
                'min_rank': min_rank,
                'rank_log_diff': np.log(student_rank + 1) - np.log(min_rank + 1),

                # 分数特征
                'min_score': min_score,
                'avg_score': avg_score,
                'score_spread': avg_score - min_score,
                'score_line_est': row['score_line_est'],
                'line_diff': line_diff_est,
                'student_line_diff': student_line_diff,

                # 院校特征
                'is_985': int(row.get('is_985', 0)),
                'is_211': int(row.get('is_211', 0)),
                'is_dual_first_class': int(row.get('is_dual_first_class', 0)),
                'tier_code': row['tier_code'],
                'school_type_code': row['school_type_code'],
                'uni_rank_log': row['uni_rank_log'],
                'best_discipline': row['best_discipline'],

                # 时空特征
                'province_code': row['province_code'],
                'year': row['year'],
                'year_norm': (row['year'] - 2020) / 5.0,

                # 交叉特征
                'rank_tier_interaction': rank_ratio * row['tier_code'],
                'is985_rank_ratio': int(row.get('is_985', 0)) * rank_ratio,
            })
            labels_list.append(label)

    X = pd.DataFrame(features_list)
    y = np.array(labels_list)

    # 清理异常值
    X = X.replace([np.inf, -np.inf], np.nan).fillna(0)

    print(f"  特征矩阵: {X.shape[0]} 样本 × {X.shape[1]} 特征")
    print(f"  正样本: {y.sum()} ({y.mean()*100:.1f}%), 负样本: {(1-y).sum()} ({(1-y.mean())*100:.1f}%)")

    # 保存
    X.to_csv(DATA_DIR / 'features.csv', index=False)
    pd.Series(y, name='label').to_csv(DATA_DIR / 'labels.csv', index=False)

    # 保存特征名映射
    feature_meta = {
        'feature_names': list(X.columns),
        'province_mapping': dict(zip(le_province.classes_, range(len(le_province.classes_)))),
        'tier_mapping': dict(zip(le_tier.classes_, range(len(le_tier.classes_)))),
        'school_type_mapping': dict(zip(le_school_type.classes_, range(len(le_school_type.classes_)))),
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
    key_features = ['rank_ratio', 'log_rank_ratio', 'rank_log_diff', 'min_rank',
                    'min_score', 'line_diff', 'is_985', 'is_211', 'uni_rank_log',
                    'best_discipline', 'score_spread']
    available = [f for f in key_features if f in X.columns]
    corr_matrix = X[available].corr()

    # 绘制热力图
    fig, axes = plt.subplots(1, 2, figsize=(18, 7))

    # 左图：特征-标签相关性条形图
    top_n = 15
    corr_top = correlations.head(top_n)
    bars = axes[0].barh(range(top_n), corr_top.values, color='#2980b9', alpha=0.85)
    axes[0].set_yticks(range(top_n))
    axes[0].set_yticklabels(corr_top.index, fontsize=9)
    axes[0].set_xlabel('Correlation with Label')
    axes[0].set_title('Top 15 Features by Correlation')
    axes[0].invert_yaxis()

    # 右图：特征间相关性热力图
    sns.heatmap(corr_matrix, annot=True, fmt='.2f', cmap='RdBu_r', center=0,
                ax=axes[1], square=True, linewidths=0.5,
                cbar_kws={'shrink': 0.8}, annot_kws={'size': 7})
    axes[1].set_title('Feature Correlation Matrix')

    plt.tight_layout()
    plt.savefig(REPORT_DIR / 'correlation_analysis.png', dpi=150, bbox_inches='tight')
    plt.close()
    print(f"\n  相关性图表已保存到 {REPORT_DIR / 'correlation_analysis.png'}")

    return correlations


# ─── 4. Model Training ──────────────────────────────────────────────────────

def train_models(X, y, skip_torch=False):
    """训练 XGBoost + LightGBM + PyTorch 模型"""
    print("\n" + "=" * 60)
    print("[4/6] 模型训练")
    print("=" * 60)

    # 划分训练/验证/测试集
    X_train, X_temp, y_train, y_temp = train_test_split(
        X, y, test_size=0.3, random_state=42, stratify=y
    )
    X_val, X_test, y_val, y_test = train_test_split(
        X_temp, y_temp, test_size=0.5, random_state=42, stratify=y_temp
    )

    print(f"  训练集: {len(X_train)}, 验证集: {len(X_val)}, 测试集: {len(X_test)}")

    results = {}

    # ─── XGBoost ───
    print("\n  --- XGBoost ---")
    xgb_params = {
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

    xgb_model = xgb.XGBClassifier(**xgb_params)
    xgb_model.fit(
        X_train, y_train,
        eval_set=[(X_val, y_val)],
        verbose=50,
    )

    xgb_calibrated = CalibratedClassifierCV(
        xgb_model, method='isotonic', cv=5
    )
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
        xgb_model.feature_importances_,
        index=X.columns
    ).sort_values(ascending=False)
    print("\n  XGBoost Top 10 特征重要性:")
    for i, (feat, imp) in enumerate(importance.head(10).items()):
        print(f"    {i+1}. {feat}: {imp:.4f}")

    importance.to_csv(REPORT_DIR / 'xgboost_importance.csv')

    # ─── LightGBM ───
    print("\n  --- LightGBM ---")
    lgb_params = {
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

    lgb_model = lgb.LGBMClassifier(**lgb_params)
    lgb_model.fit(
        X_train, y_train,
        eval_set=[(X_val, y_val)],
    )

    lgb_calibrated = CalibratedClassifierCV(
        lgb_model, method='isotonic', cv=5
    )
    lgb_calibrated.fit(X_val, y_val)

    lgb_prob = lgb_calibrated.predict_proba(X_test)[:, 1]
    lgb_pred = lgb_calibrated.predict(X_test)
    results['lightgbm'] = evaluate_model('LightGBM', lgb_prob, lgb_pred, y_test)

    lgb_model.booster_.save_model(str(MODEL_DIR / 'lightgbm_model.txt'))
    joblib.dump(lgb_calibrated, MODEL_DIR / 'lightgbm_calibrated.pkl')

    lgb_importance = pd.Series(
        lgb_model.feature_importances_,
        index=X.columns
    ).sort_values(ascending=False)
    lgb_importance.to_csv(REPORT_DIR / 'lightgbm_importance.csv')

    # ─── PyTorch ───
    if not skip_torch:
        print("\n  --- PyTorch MLP ---")
        try:
            import torch
            import torch.nn as nn
            from torch.utils.data import TensorDataset, DataLoader

            torch_prob, torch_pred = train_pytorch_model(
                X_train, y_train, X_val, y_val, X_test
            )
            results['pytorch'] = evaluate_model('PyTorch MLP', torch_prob, torch_pred, y_test)
        except Exception as e:
            print(f"  PyTorch 训练失败: {e}")
            results['pytorch'] = None

    # 保存结果
    with open(REPORT_DIR / 'results_summary.json', 'w', encoding='utf-8') as f:
        json.dump(results, f, ensure_ascii=False, indent=2)

    return results, X_test, y_test, {
        'xgboost': xgb_calibrated,
        'lightgbm': lgb_calibrated,
    }


def train_pytorch_model(X_train, y_train, X_val, y_val, X_test):
    """PyTorch MLP 模型"""
    import torch
    import torch.nn as nn
    from torch.utils.data import TensorDataset, DataLoader

    # 标准化
    scaler = StandardScaler()
    X_train_s = scaler.fit_transform(X_train)
    X_val_s = scaler.transform(X_val)
    X_test_s = scaler.transform(X_test)

    # 保存 scaler
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

        # 验证
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

    # 加载最佳模型并预测
    model.load_state_dict(torch.load(MODEL_DIR / 'pytorch_model.pth', weights_only=True))
    model.eval()
    with torch.no_grad():
        test_prob = model(torch.FloatTensor(X_test_s).to(device)).cpu().numpy()
        test_pred = (test_prob > 0.5).astype(int)

    print(f"    Best val AUC: {best_val_auc:.4f}")
    return test_prob, test_pred


# ─── 5. Evaluation ──────────────────────────────────────────────────────────

def evaluate_model(name, prob, pred, y_true):
    """评估单个模型"""
    auc = roc_auc_score(y_true, prob)
    brier = brier_score_loss(y_true, prob)
    ll = log_loss(y_true, prob)
    acc = accuracy_score(y_true, pred)
    prec = precision_score(y_true, pred, zero_division=0)
    rec = recall_score(y_true, pred, zero_division=0)
    f1 = f1_score(y_true, pred, zero_division=0)

    print(f"    {name}:")
    print(f"      AUC={auc:.4f}  Brier={brier:.4f}  LogLoss={ll:.4f}")
    print(f"      Acc={acc:.4f}  Precision={prec:.4f}  Recall={rec:.4f}  F1={f1:.4f}")

    return {
        'name': name,
        'auc': round(auc, 4),
        'brier': round(brier, 4),
        'log_loss': round(ll, 4),
        'accuracy': round(acc, 4),
        'precision': round(prec, 4),
        'recall': round(rec, 4),
        'f1': round(f1, 4),
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
    ax.set_title('ROC Curve Comparison')
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
    metrics = ['auc', 'accuracy', 'precision', 'recall', 'f1']
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
    ax.set_title('Model Metrics Comparison')
    ax.legend(fontsize=9)

    plt.tight_layout()
    plt.savefig(REPORT_DIR / 'evaluation_report.png', dpi=150, bbox_inches='tight')
    plt.close()

    # 概率校准图
    fig, ax = plt.subplots(figsize=(8, 6))
    for name, model in models.items():
        prob = model.predict_proba(X_test)[:, 1]
        # 分 10 个桶
        bins = np.linspace(0, 1, 11)
        bin_idx = np.digitize(prob, bins) - 1
        bin_idx = np.clip(bin_idx, 0, 9)

        bin_means = [prob[bin_idx == i].mean() if (bin_idx == i).sum() > 0 else 0 for i in range(10)]
        bin_true = [y_test[bin_idx == i].mean() if (bin_idx == i).sum() > 0 else 0 for i in range(10)]

        ax.plot(bin_means, bin_true, 'o-', label=name, linewidth=2)

    ax.plot([0, 1], [0, 1], 'k--', alpha=0.3, label='Perfect calibration')
    ax.set_xlabel('Mean Predicted Probability')
    ax.set_ylabel('Fraction of Positives')
    ax.set_title('Calibration Plot')
    ax.legend()
    plt.tight_layout()
    plt.savefig(REPORT_DIR / 'calibration_plot.png', dpi=150)
    plt.close()

    print(f"  报告图表已保存到 {REPORT_DIR}/")
    print(f"    - evaluation_report.png (ROC/PR/概率分布/指标对比)")
    print(f"    - calibration_plot.png (概率校准图)")
    print(f"    - correlation_analysis.png (特征相关性)")
    print(f"    - results_summary.json (指标汇总)")


# ─── 6. Prediction API ──────────────────────────────────────────────────────

def save_prediction_api():
    """生成预测推理脚本"""
    print("\n" + "=" * 60)
    print("[6/6] 生成预测 API")
    print("=" * 60)

    api_code = '''"""
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
'''

    with open(Path(__file__).parent / 'predict.py', 'w', encoding='utf-8') as f:
        f.write(api_code)
    print(f"  预测 API 已保存到 packages/ml/predict.py")


# ─── Main ───────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description='智渡录取概率 ML Pipeline')
    parser.add_argument('--export-only', action='store_true', help='仅导出数据')
    parser.add_argument('--skip-export', action='store_true', help='跳过导出（使用已有数据）')
    parser.add_argument('--skip-torch', action='store_true', help='跳过 PyTorch 训练')
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
    results, X_test, y_test, models = train_models(X, y, skip_torch=args.skip_torch)

    # Step 5: Evaluation Report
    generate_report(results, X_test, y_test, models, correlations)

    # Step 6: Prediction API
    save_prediction_api()

    # 最终汇总
    print("\n" + "=" * 60)
    print("Pipeline 完成！")
    print("=" * 60)
    print(f"\n  输出目录: {OUTPUT_DIR}")
    print(f"  模型文件: {MODEL_DIR}/")
    print(f"  评估报告: {REPORT_DIR}/")
    print(f"  预测 API: packages/ml/predict.py")

    print("\n  模型性能汇总:")
    for name, res in results.items():
        if res:
            print(f"    {res['name']}: AUC={res['auc']:.4f}, F1={res['f1']:.4f}, Brier={res['brier']:.4f}")

    # 测试预测 API
    print("\n  测试预测 API...")
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
    except Exception as e:
        print(f"    预测 API 测试失败: {e}")


if __name__ == '__main__':
    main()
