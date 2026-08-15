# Backend Dockerfile
FROM python:3.13-slim

WORKDIR /app

# 换阿里云 Debian 源（国内加速）
RUN sed -i 's/deb.debian.org/mirrors.aliyun.com/g' /etc/apt/sources.list.d/debian.sources 2>/dev/null || \
    sed -i 's/deb.debian.org/mirrors.aliyun.com/g' /etc/apt/sources.list

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy project
COPY . .

# 配置兜底：镜像内没有 config.json（被 .gitignore）时用模板生成。
# 数据库等运行时参数在 docker-compose 中用 DB_* 环境变量覆盖。
RUN if [ ! -f config.json ]; then cp config.example.json config.json; fi

# Collect static files
RUN python manage.py collectstatic --noinput || true

EXPOSE 19424

# Run with gunicorn for production
CMD ["gunicorn", "OpenSHSID_backend.wsgi:application", "--bind", "[::]:19424", "--workers", "3"]
