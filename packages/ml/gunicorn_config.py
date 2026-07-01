"""
智渡 ML 推理服务 — Gunicorn 生产配置
======================================
用法: gunicorn -c gunicorn_config.py serve:app

生产部署命令:
  gunicorn -c gunicorn_config.py serve:app \
    --bind 0.0.0.0:5100 \
    --env ML_API_KEY=<your-key>
"""

import multiprocessing
import os

# ─── 绑定 ───────────────────────────────────────────────────────────────────

bind = os.environ.get('GUNICORN_BIND', '0.0.0.0:5100')

# ─── 进程模型 ────────────────────────────────────────────────────────────────
# ML 推理是 CPU 密集型，但 XGBoost/LightGBM 内部已多线程
# 使用较少 worker 避免内存爆炸（每个 worker 加载一份模型）
# 推荐: 2-4 workers for ML serving (not the default 2*CPU+1)
workers = int(os.environ.get('GUNICORN_WORKERS', '2'))
worker_class = 'sync'
timeout = int(os.environ.get('GUNICORN_TIMEOUT', '120'))
graceful_timeout = 30
keepalive = 5

# ─── 内存保护 ────────────────────────────────────────────────────────────────
# 单 worker 处理 N 个请求后自动重启，防止内存泄漏
max_requests = int(os.environ.get('GUNICORN_MAX_REQUESTS', '1000'))
max_requests_jitter = 50

# ─── 日志 ────────────────────────────────────────────────────────────────────
loglevel = os.environ.get('LOG_LEVEL', 'info')
accesslog = '-'  # stdout
errorlog = '-'   # stderr
access_log_format = '%(h)s %(l)s %(u)s %(t)s "%(r)s" %(s)s %(b)s %(D)sms'

# ─── 进程名 ──────────────────────────────────────────────────────────────────
proc_name = 'zhidu-ml-predictor'

# ─── 预加载 ──────────────────────────────────────────────────────────────────
# preload_app=True: master 进程加载模型后 fork workers
# 优点: 启动快、内存省（COW）
# 缺点: 如果模型需要 GPU 或多进程不共享，需要 False
preload_app = True


def on_starting(server):
    """Master 进程启动时的日志"""
    server.log.info(f"智渡 ML 推理服务启动 — {workers} workers, bind={bind}")


def post_fork(server, worker):
    """Worker fork 后的日志"""
    server.log.info(f"Worker {worker.pid} forked")


def worker_exit(server, worker):
    """Worker 退出时的清理"""
    server.log.info(f"Worker {worker.pid} exiting")
