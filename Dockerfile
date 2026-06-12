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

# Collect static files
RUN python manage.py collectstatic --noinput || true

EXPOSE 19424

# Run with gunicorn for production
CMD ["gunicorn", "OpenSHSID_backend.wsgi:application", "--bind", "[::]:19424", "--workers", "3"]
