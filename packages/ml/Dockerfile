FROM python:3.11-slim

LABEL maintainer="zhidu-team"
LABEL description="智渡 ML 录取概率推理微服务"

# 安全: 不以 root 运行
RUN groupadd -r mluser && useradd -r -g mluser -d /app -s /sbin/nologin mluser

WORKDIR /app

# 安装系统依赖（XGBoost/LightGBM 可能需要 libgomp）
RUN apt-get update && \
    apt-get install -y --no-install-recommends libgomp1 && \
    rm -rf /var/lib/apt/lists/*

# 先复制依赖文件（利用 Docker 层缓存）
COPY requirements.txt .

# 安装 Python 依赖（排除开发依赖）
RUN pip install --no-cache-dir \
    gunicorn>=22.0 \
    xgboost>=2.0 \
    lightgbm>=4.0 \
    scikit-learn>=1.3 \
    pandas>=2.0 \
    numpy>=1.24 \
    flask>=3.0 \
    flask-cors>=4.0 \
    joblib>=1.3

# 复制代码
COPY features.py .
COPY serve.py .
COPY predict.py .
COPY gunicorn_config.py .

# 复制训练好的模型（构建时需先运行 pipeline.py train）
COPY output/models/ ./output/models/
COPY output/data/ ./output/data/

# 切换到非 root 用户
RUN chown -R mluser:mluser /app
USER mluser

# 环境变量
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1

EXPOSE 5100

# 健康检查
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:5100/health')" || exit 1

# 生产启动命令
CMD ["gunicorn", "-c", "gunicorn_config.py", "serve:app"]
