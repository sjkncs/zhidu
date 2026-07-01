"""
智渡 ML — 共享特征工程模块
============================
特征定义的唯一来源 (Single Source of Truth)。
pipeline.py / serve.py / predict.py 均从此处导入特征名和构建函数。

v2 (Phase 19) 修复项:
- 移除目标泄漏特征: min_rank, min_score, avg_score 原始值
- 移除冗余单调变换: log_rank_ratio, rank_log_diff, score_gap_ratio
- 用显式映射替代 LabelEncoder (避免全量数据拟合导致的信息泄漏)
- 新增相对特征: school_selectivity, province_baseline
"""

import math
from typing import Any

# ─── 分类标签映射（显式，不依赖 sklearn LabelEncoder）─────────────────────

# 省份 → 编码（31 个省级行政区）
PROVINCE_LABELS: list[str] = [
    '北京', '天津', '河北', '山西', '内蒙古',
    '辽宁', '吉林', '黑龙江', '上海', '江苏',
    '浙江', '安徽', '福建', '江西', '山东',
    '河南', '湖北', '湖南', '广东', '广西',
    '海南', '重庆', '四川', '贵州', '云南',
    '西藏', '陕西', '甘肃', '青海', '宁夏', '新疆',
]
PROVINCE_TO_CODE: dict[str, int] = {p: i for i, p in enumerate(PROVINCE_LABELS)}

# 办学层次 → 编码
TIER_LABELS: list[str] = ['985/211', '双一流', '省属重点', '普通本科', '高职专科']
TIER_TO_CODE: dict[str, int] = {t: i for i, t in enumerate(TIER_LABELS)}

# 学校类型 → 编码
SCHOOL_TYPE_LABELS: list[str] = [
    '综合', '理工', '师范', '医药', '财经',
    '政法', '农林', '民族', '语言', '体育', '艺术', '军事', '其他',
]
SCHOOL_TYPE_TO_CODE: dict[str, int] = {t: i for i, t in enumerate(SCHOOL_TYPE_LABELS)}

# 学科评估等级 → 数值（越小越好）
EVAL_RATING_ORDER: dict[str, int] = {
    'A+': 1, 'A': 2, 'A-': 3, 'B+': 4, 'B': 5, 'B-': 6,
    'C+': 7, 'C': 8, 'C-': 9, 'D': 10,
}

# ─── 特征配置 ─────────────────────────────────────────────────────────────

# 19 个特征 — 训练与推理必须严格对齐此顺序
FEATURE_NAMES: list[str] = [
    # === 核心位次特征 (3) ===
    'rank_ratio',           # 考生位次 / 历史最低位次（<1 = 位次优于录取线）
    'rank_ratio_sq',        # rank_ratio^2（捕捉非线性录取概率拐点）
    'rank_inv',             # 1 / rank_ratio（反比特征，对高比率更敏感）

    # === 考生上下文 (2) ===
    'student_rank',         # 考生位次（绝对值，捕捉省/年上下文）
    'student_rank_log',     # log(student_rank)（压缩尺度）

    # === 院校属性 (8) ===
    'is_985',               # 是否 985 院校
    'is_211',               # 是否 211 院校
    'is_dual_first_class',  # 是否双一流
    'tier_code',            # 办学层次编码
    'school_type_code',     # 学校类型编码
    'uni_rank_log',         # log(1 + 院校排名)
    'best_discipline',      # 最佳学科评估等级数值
    'school_selectivity',   # (min_score - 省控线) / 100（院校相对选拔度）

    # === 分数衍生 (2) ===
    'score_spread_norm',    # (avg_score - min_score) / 100（分数离散度）
    'student_line_diff',    # 估算考生分 - 省控线

    # === 时空 (2) ===
    'province_code',        # 省份编码
    'year_norm',            # (year - 2020) / 5.0

    # === 交叉特征 (2) ===
    'rank_tier_interaction',   # rank_ratio × tier_code
    'is985_rank_ratio',        # is_985 × rank_ratio
]

assert len(FEATURE_NAMES) == 19, f'Expected 19 features, got {len(FEATURE_NAMES)}'

# 合成样本超参（pipeline 训练用）
SYNTH_SAMPLES_PER_RECORD = 8
NOISE_STD = 0.05


# ─── 工具函数 ─────────────────────────────────────────────────────────────

def map_province(province: str) -> int:
    """省份名 → 编码，未知返回 0"""
    return PROVINCE_TO_CODE.get(province, 0)


def map_tier(tier: Any) -> int:
    """办学层次 → 编码，未知返回 3（普通本科）"""
    if tier is None or (isinstance(tier, float) and math.isnan(tier)):
        return 3
    return TIER_TO_CODE.get(str(tier), 3)


def map_school_type(stype: Any) -> int:
    """学校类型 → 编码，未知返回 0（综合）"""
    if stype is None or (isinstance(stype, float) and math.isnan(stype)):
        return 0
    return SCHOOL_TYPE_TO_CODE.get(str(stype), 0)


def build_feature_dict(
    student_rank: float,
    min_rank: float,
    min_score: float,
    avg_score: float | None = None,
    is_985: bool | int = False,
    is_211: bool | int = False,
    is_dual_first_class: bool | int = False,
    tier: str | int = '普通本科',
    school_type: str | int = '综合',
    uni_rank: float = 100,
    best_discipline: float = 5,
    province: str | int = '',
    year: int = 2026,
    score_line_est: float = 400,
    school_selectivity: float = 0.0,
) -> dict[str, float]:
    """
    从原始业务参数构建 18 维特征字典。

    pipeline 训练和 serve/predict 推理均调用此函数，保证特征一致。

    Args:
        student_rank:       考生位次
        min_rank:           历史最低录取位次（加权均值）
        min_score:          历史最低录取分
        avg_score:          历史平均录取分（None 则用 min_score）
        is_985/211/dfc:     院校标志
        tier:               办学层次（字符串或已编码的整数）
        school_type:        学校类型（字符串或已编码的整数）
        uni_rank:           院校综合排名
        best_discipline:    最佳学科评估等级数值
        province:           省份（字符串或已编码的整数）
        year:               年份
        score_line_est:     省控线估计（同省同年最低分）
        school_selectivity: (min_score - 省控线) / 100

    Returns:
        dict[str, float] — 18 个特征，键名与 FEATURE_NAMES 对齐
    """
    if avg_score is None:
        avg_score = min_score

    # --- 编码分类变量 ---
    is_985_i = int(bool(is_985))
    is_211_i = int(bool(is_211))
    is_dfc_i = int(bool(is_dual_first_class))

    if isinstance(tier, str):
        tier_code = map_tier(tier)
    else:
        tier_code = int(tier)

    if isinstance(school_type, str):
        school_type_code = map_school_type(school_type)
    else:
        school_type_code = int(school_type)

    if isinstance(province, str):
        province_code = map_province(province)
    else:
        province_code = int(province)

    # --- 核心位次特征 ---
    rank_ratio = student_rank / max(min_rank, 1)

    # --- 分数衍生 ---
    score_spread_norm = max(0.0, (avg_score - min_score)) / 100.0
    student_score_est = min_score * (1 + (rank_ratio - 1) * 0.5)
    student_line_diff_val = student_score_est - score_line_est

    return {
        # 核心位次
        'rank_ratio': rank_ratio,
        'rank_ratio_sq': rank_ratio ** 2,
        'rank_inv': 1.0 / max(rank_ratio, 0.01),
        # 考生上下文
        'student_rank': student_rank,
        'student_rank_log': math.log(max(student_rank, 1)),
        # 院校属性
        'is_985': is_985_i,
        'is_211': is_211_i,
        'is_dual_first_class': is_dfc_i,
        'tier_code': tier_code,
        'school_type_code': school_type_code,
        'uni_rank_log': math.log(uni_rank + 1),
        'best_discipline': float(best_discipline),
        'school_selectivity': float(school_selectivity),
        # 分数衍生
        'score_spread_norm': score_spread_norm,
        'student_line_diff': student_line_diff_val,
        # 时空
        'province_code': province_code,
        'year_norm': (year - 2020) / 5.0,
        # 交叉特征
        'rank_tier_interaction': rank_ratio * tier_code,
        'is985_rank_ratio': is_985_i * rank_ratio,
    }


def feature_dict_to_row(features: dict[str, float]) -> list[float]:
    """特征字典 → 按 FEATURE_NAMES 顺序排列的列表（用于 DataFrame 构建）"""
    return [features.get(name, 0.0) for name in FEATURE_NAMES]


# ─── 推理辅助（serve.py / predict.py 使用）──────────────────────────────

def build_inference_features(
    student_rank: float,
    min_rank: float,
    min_score: float,
    avg_score: float | None = None,
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
) -> dict[str, float]:
    """
    从 API 请求参数构建特征字典（兼容旧版 serve.py 的输入格式）。

    旧 API 传入 tier_code/school_type_code/province_code 等已编码的整数，
    此函数将它们透传给 build_feature_dict。

    line_diff 和 score_spread 参数保留以兼容旧接口，但内部转换为新特征。
    """
    school_selectivity = max(0.0, line_diff) / 100.0

    return build_feature_dict(
        student_rank=student_rank,
        min_rank=min_rank,
        min_score=min_score,
        avg_score=avg_score,
        is_985=is_985,
        is_211=is_211,
        is_dual_first_class=is_dual_first_class,
        tier=tier_code,           # 已编码的整数
        school_type=school_type_code,
        uni_rank=uni_rank,
        best_discipline=best_discipline,
        province=province_code,   # 已编码的整数
        year=year,
        score_line_est=score_line_est,
        school_selectivity=school_selectivity,
    )
