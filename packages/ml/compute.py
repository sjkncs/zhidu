"""
智渡数学计算引擎
================
基于 SymPy + SciPy 的符号数学与数值计算服务。
支持：方程求解、微积分、矩阵运算、极限、级数、物理公式。

供 /compute API 端点调用，AI Agent 通过 Function Calling 使用。
"""

import math
import json
from typing import Any

import numpy as np

try:
    import sympy as sp
    from sympy import (
        Symbol, symbols, solve, diff, integrate, limit, series,
        Matrix, simplify, factor, expand, Rational, pi, E, oo,
        sqrt, sin, cos, tan, log, exp, Abs,
        latex, pretty,
    )
    from sympy.parsing.sympy_parser import (
        parse_expr, standard_transformations, implicit_multiplication_application,
        convert_xor,
    )
    HAS_SYMPY = True
except ImportError:
    HAS_SYMPY = False

try:
    from scipy import optimize, integrate as sp_integrate, stats
    HAS_SCIPY = True
except ImportError:
    HAS_SCIPY = False


# ─── SymPy 解析配置 ──────────────────────────────────────────────────────

_TRANSFORMATIONS = standard_transformations + (implicit_multiplication_application, convert_xor)

# 预定义常用符号（用户可直接使用）
_COMMON_SYMBOLS = {
    'x': Symbol('x'), 'y': Symbol('y'), 'z': Symbol('z'),
    'a': Symbol('a'), 'b': Symbol('b'), 'c': Symbol('c'),
    'n': Symbol('n'), 'k': Symbol('k'), 'm': Symbol('m'),
    't': Symbol('t'), 'v': Symbol('v'), 'r': Symbol('r'),
    'theta': Symbol('theta'), 'pi': pi, 'e': E,
}


def _parse_expr(expr_str: str):
    """安全解析数学表达式为 SymPy 表达式"""
    if not HAS_SYMPY:
        raise RuntimeError("SymPy not installed")
    return parse_expr(expr_str, local_dict=_COMMON_SYMBOLS, transformations=_TRANSFORMATIONS)


# ─── 计算操作 ─────────────────────────────────────────────────────────────

def evaluate(expression: str) -> dict:
    """
    计算表达式值（数值结果）
    示例: "2**10 + sqrt(2)", "sin(pi/4)"
    """
    expr = _parse_expr(expression)
    result = expr.evalf()

    # 如果是纯数值，转 float
    if result.is_number:
        val = float(result)
        return {
            'type': 'value',
            'expression': expression,
            'result': val,
            'latex': latex(expr),
            'exact': str(expr),
        }

    # 符号表达式
    return {
        'type': 'expression',
        'expression': expression,
        'result': str(result),
        'latex': latex(result),
    }


def solve_equation(equation: str, variable: str | None = None) -> dict:
    """
    求解方程
    示例: equation="x**2 - 5*x + 6", variable="x" → x=2, x=3
    示例: equation="2*x + 3*y - 12"（需配合 system）
    """
    eq_expr = _parse_expr(equation)
    if variable:
        sym = _COMMON_SYMBOLS.get(variable, Symbol(variable))
        solutions = solve(eq_expr, sym)
    else:
        # 自动检测自由符号
        free = eq_expr.free_symbols
        if not free:
            return {'type': 'solution', 'equation': equation, 'solutions': [], 'note': '无未知数'}
        sym = sorted(free, key=str)[0]
        solutions = solve(eq_expr, sym)

    sol_list = []
    for s in solutions:
        try:
            sol_list.append({'exact': str(s), 'latex': latex(s), 'approx': float(s.evalf())})
        except (TypeError, ValueError):
            sol_list.append({'exact': str(s), 'latex': latex(s)})

    return {
        'type': 'solution',
        'equation': equation,
        'variable': str(sym),
        'solutions': sol_list,
        'count': len(sol_list),
    }


def solve_system(equations: list[str], variables: list[str]) -> dict:
    """
    求解方程组
    示例: equations=["x + y - 5", "2*x - y - 1"], variables=["x", "y"]
    """
    eq_exprs = [_parse_expr(eq) for eq in equations]
    syms = [_COMMON_SYMBOLS.get(v, Symbol(v)) for v in variables]

    solutions = solve(eq_exprs, syms)

    if isinstance(solutions, dict):
        result = {}
        for sym, val in solutions.items():
            try:
                result[str(sym)] = {'exact': str(val), 'latex': latex(val), 'approx': float(val.evalf())}
            except (TypeError, ValueError):
                result[str(sym)] = {'exact': str(val), 'latex': latex(val)}
        return {'type': 'system_solution', 'equations': equations, 'variables': variables, 'solution': result}
    elif isinstance(solutions, list):
        sol_list = []
        for sol in solutions:
            d = {}
            for sym, val in (sol.items() if isinstance(sol, dict) else zip(syms, sol if isinstance(sol, tuple) else [sol])):
                try:
                    d[str(sym)] = {'exact': str(val), 'approx': float(val.evalf())}
                except (TypeError, ValueError):
                    d[str(sym)] = {'exact': str(val)}
            sol_list.append(d)
        return {'type': 'system_solution', 'equations': equations, 'variables': variables, 'solutions': sol_list, 'count': len(sol_list)}
    else:
        return {'type': 'system_solution', 'equations': equations, 'variables': variables, 'solution': str(solutions)}


def derivative(expression: str, variable: str = 'x', order: int = 1) -> dict:
    """
    求导数
    示例: expression="x**3 + 2*x**2 - x + 1", variable="x", order=1
    """
    expr = _parse_expr(expression)
    sym = _COMMON_SYMBOLS.get(variable, Symbol(variable))
    result = diff(expr, sym, order)
    return {
        'type': 'derivative',
        'expression': expression,
        'variable': variable,
        'order': order,
        'result': str(result),
        'latex': latex(result),
    }


def integral(expression: str, variable: str = 'x', lower: str | None = None, upper: str | None = None) -> dict:
    """
    求积分（不定或定积分）
    示例: expression="x**2", variable="x" → 不定积分
    示例: expression="x**2", variable="x", lower="0", upper="1" → 定积分 1/3
    """
    expr = _parse_expr(expression)
    sym = _COMMON_SYMBOLS.get(variable, Symbol(variable))

    if lower is not None and upper is not None:
        lo = _parse_expr(lower)
        hi = _parse_expr(upper)
        result = integrate(expr, (sym, lo, hi))
        try:
            approx = float(result.evalf())
        except (TypeError, ValueError):
            approx = None
        return {
            'type': 'definite_integral',
            'expression': expression,
            'variable': variable,
            'bounds': f'[{lower}, {upper}]',
            'result': str(result),
            'approx': approx,
            'latex': latex(result),
        }
    else:
        result = integrate(expr, sym)
        return {
            'type': 'indefinite_integral',
            'expression': expression,
            'variable': variable,
            'result': str(result),
            'latex': latex(result),
        }


def matrix_operation(operation: str, matrices: dict[str, list[list]]) -> dict:
    """
    矩阵运算
    operation: "det", "inv", "eigenvalues", "multiply", "add", "rref"
    """
    mats = {k: Matrix(v) for k, v in matrices.items()}

    if operation == 'det' and 'A' in mats:
        det_val = mats['A'].det()
        return {'type': 'matrix', 'operation': 'det', 'result': str(det_val), 'latex': latex(det_val)}

    elif operation == 'inv' and 'A' in mats:
        inv_mat = mats['A'].inv()
        return {'type': 'matrix', 'operation': 'inv', 'result': str(inv_mat), 'latex': latex(inv_mat)}

    elif operation == 'eigenvalues' and 'A' in mats:
        eigen = mats['A'].eigenvals()
        result = {str(k): {'value': str(k), 'multiplicity': int(v)} for k, v in eigen.items()}
        return {'type': 'matrix', 'operation': 'eigenvalues', 'eigenvalues': result}

    elif operation == 'multiply' and 'A' in mats and 'B' in mats:
        product = mats['A'] * mats['B']
        return {'type': 'matrix', 'operation': 'multiply', 'result': str(product), 'latex': latex(product)}

    elif operation == 'add' and 'A' in mats and 'B' in mats:
        result = mats['A'] + mats['B']
        return {'type': 'matrix', 'operation': 'add', 'result': str(result), 'latex': latex(result)}

    elif operation == 'rref' and 'A' in mats:
        rref_mat, pivot_cols = mats['A'].rref()
        return {
            'type': 'matrix', 'operation': 'rref',
            'result': str(rref_mat), 'pivot_columns': list(pivot_cols),
            'latex': latex(rref_mat),
        }

    else:
        return {'error': f'Unsupported matrix operation: {operation}'}


def limit_calc(expression: str, variable: str = 'x', point: str = '0', direction: str = '+-') -> dict:
    """
    求极限
    示例: expression="sin(x)/x", variable="x", point="0"
    """
    expr = _parse_expr(expression)
    sym = _COMMON_SYMBOLS.get(variable, Symbol(variable))
    pt = _parse_expr(point)

    if direction == '+':
        result = limit(expr, sym, pt, '+')
    elif direction == '-':
        result = limit(expr, sym, pt, '-')
    else:
        result = limit(expr, sym, pt)

    return {
        'type': 'limit',
        'expression': expression,
        'variable': variable,
        'point': point,
        'result': str(result),
        'approx': float(result.evalf()) if result.is_number else None,
        'latex': latex(result),
    }


def series_expand(expression: str, variable: str = 'x', point: str = '0', order: int = 6) -> dict:
    """
    泰勒展开
    示例: expression="exp(x)", variable="x", point="0", order=6
    """
    expr = _parse_expr(expression)
    sym = _COMMON_SYMBOLS.get(variable, Symbol(variable))
    pt = _parse_expr(point)
    result = series(expr, sym, pt, order)
    return {
        'type': 'series',
        'expression': expression,
        'variable': variable,
        'point': point,
        'order': order,
        'result': str(result),
        'latex': latex(result),
    }


# ─── 物理公式快捷计算 ────────────────────────────────────────────────────

def physics_formula(formula: str, params: dict[str, float]) -> dict:
    """
    物理公式计算
    支持的公式类型:
    - kinematics_v: v = v0 + a*t
    - kinematics_s: s = v0*t + 0.5*a*t**2
    - kinetic_energy: KE = 0.5*m*v**2
    - potential_energy: PE = m*g*h
    - ohms_law: V = I*R
    - power: P = V*I
    - coulomb: F = k*q1*q2/r**2
    - lens: 1/f = 1/u + 1/v
    - ideal_gas: P*V = n*R*T
    - snell: n1*sin(theta1) = n2*sin(theta2)
    """
    K_COULOMB = 8.9875517873681764e9  # N⋅m²/C²
    R_GAS = 8.314  # J/(mol⋅K)
    G_ACCEL = 9.81  # m/s²

    formulas = {
        'kinematics_v': lambda p: p.get('v0', 0) + p.get('a', 0) * p.get('t', 0),
        'kinematics_s': lambda p: p.get('v0', 0) * p.get('t', 0) + 0.5 * p.get('a', 0) * p.get('t', 0)**2,
        'kinetic_energy': lambda p: 0.5 * p.get('m', 0) * p.get('v', 0)**2,
        'potential_energy': lambda p: p.get('m', 0) * G_ACCEL * p.get('h', 0),
        'ohms_law': lambda p: p.get('I', 0) * p.get('R', 0),
        'power': lambda p: p.get('V', 0) * p.get('I', 0),
        'coulomb': lambda p: K_COULOMB * p.get('q1', 0) * p.get('q2', 0) / p.get('r', 1)**2,
        'lens': lambda p: 1.0 / (1.0 / p.get('u', 1) + 1.0 / p.get('v', 1)) if p.get('u') and p.get('v') else 0,
        'ideal_gas': lambda p: p.get('n', 0) * R_GAS * p.get('T', 0) / p.get('V', 1),
        'snell': lambda p: p.get('n1', 1) * math.sin(math.radians(p.get('theta1', 0))) / p.get('n2', 1),
    }

    formula_descriptions = {
        'kinematics_v': '匀变速直线运动: v = v₀ + at',
        'kinematics_s': '匀变速直线运动: s = v₀t + ½at²',
        'kinetic_energy': '动能: E_k = ½mv²',
        'potential_energy': '重力势能: E_p = mgh',
        'ohms_law': '欧姆定律: V = IR',
        'power': '电功率: P = VI',
        'coulomb': '库仑定律: F = kq₁q₂/r²',
        'lens': '薄透镜公式: 1/f = 1/u + 1/v',
        'ideal_gas': '理想气体状态方程: PV = nRT',
        'snell': '斯涅尔定律: n₁sinθ₁ = n₂sinθ₂',
    }

    if formula not in formulas:
        return {'error': f'Unknown formula: {formula}. Available: {list(formulas.keys())}'}

    try:
        result = formulas[formula](params)
        return {
            'type': 'physics',
            'formula': formula,
            'description': formula_descriptions.get(formula, formula),
            'params': params,
            'result': round(result, 6) if isinstance(result, float) else result,
            'unit': _get_unit(formula),
        }
    except Exception as e:
        return {'error': f'Calculation failed: {str(e)}', 'formula': formula, 'params': params}


def _get_unit(formula: str) -> str:
    """返回公式对应的标准单位"""
    units = {
        'kinematics_v': 'm/s',
        'kinematics_s': 'm',
        'kinetic_energy': 'J',
        'potential_energy': 'J',
        'ohms_law': 'V',
        'power': 'W',
        'coulomb': 'N',
        'lens': 'm',
        'ideal_gas': 'Pa',
        'snell': 'rad (θ₂)',
    }
    return units.get(formula, '')


# ─── 统一入口 ────────────────────────────────────────────────────────────

OPERATIONS = {
    'evaluate': evaluate,
    'solve': solve_equation,
    'solve_system': solve_system,
    'derivative': derivative,
    'integral': integral,
    'limit': limit_calc,
    'series': series_expand,
    'matrix': matrix_operation,
    'physics': physics_formula,
}


def compute(operation: str, **kwargs) -> dict:
    """
    统一计算入口

    Args:
        operation: 操作类型 (evaluate/solve/solve_system/derivative/integral/limit/series/matrix/physics)
        **kwargs: 操作参数

    Returns:
        计算结果字典
    """
    if not HAS_SYMPY:
        return {'error': 'SymPy not installed. Install with: pip install sympy>=1.12'}

    handler = OPERATIONS.get(operation)
    if not handler:
        return {'error': f'Unknown operation: {operation}. Available: {list(OPERATIONS.keys())}'}

    try:
        return handler(**kwargs)
    except TypeError as e:
        return {'error': f'Invalid parameters for {operation}: {str(e)}'}
    except Exception as e:
        return {'error': f'{operation} failed: {str(e)}'}
