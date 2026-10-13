# ── Stage 1: Build Frontend ──────────────────────────────────────────
FROM node:20-slim AS frontend-builder

WORKDIR /frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ .

# ✅ Build frontend with API URL (defaults to localhost:8000 in Docker)
ARG NEXT_PUBLIC_API_URL=http://localhost:8000
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}

RUN npm run build
# ── Stage 2: Build Backend Dependencies ─────────────────────────────
FROM python:3.10-slim AS backend-builder

WORKDIR /app
RUN apt-get update \
    && apt-get install -y gcc libpq-dev \
    && rm -rf /var/lib/apt/lists/*
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt \
    && pip install --no-cache-dir reportlab psycopg2-binary

# ── Stage 3: Final Runtime Image ─────────────────────────────────────
FROM python:3.10-slim AS runtime

WORKDIR /app
RUN apt-get update \
    && apt-get install -y libpq5 \
    && rm -rf /var/lib/apt/lists/*

# Copy Python packages from backend-builder
COPY --from=backend-builder /usr/local/lib/python3.10/site-packages /usr/local/lib/python3.10/site-packages
COPY --from=backend-builder /usr/local/bin /usr/local/bin

# Copy backend source code
COPY backend/ .

# Copy built frontend from frontend-builder
COPY --from=frontend-builder /frontend/out /frontend/out

# Create necessary directories
RUN mkdir -p /app/logs

# ── Gunicorn tuning (all overridable at runtime via env) ─────────────────────
#   GUNICORN_WORKERS               — defaults to (2 x CPU cores) + 1 (computed below)
#   GUNICORN_MAX_REQUESTS          — recycle a worker after N requests (bounds memory growth)
#   GUNICORN_MAX_REQUESTS_JITTER   — randomise recycle point so workers don't all restart at once
#   GUNICORN_TIMEOUT               — kill/replace a worker whose request runs longer than this (s)
ENV GUNICORN_MAX_REQUESTS=1000 \
    GUNICORN_MAX_REQUESTS_JITTER=100 \
    GUNICORN_TIMEOUT=60

EXPOSE 8000
# Run migrations, then serve via Gunicorn (a production WSGI server) instead of
# Django's single-threaded dev server. Worker count defaults to (2 x nproc) + 1.
CMD ["sh", "-c", "python manage.py migrate && gunicorn config.wsgi:application --bind 0.0.0.0:8000 --workers ${GUNICORN_WORKERS:-$((2 * $(nproc) + 1))} --max-requests ${GUNICORN_MAX_REQUESTS} --max-requests-jitter ${GUNICORN_MAX_REQUESTS_JITTER} --timeout ${GUNICORN_TIMEOUT} --access-logfile - --error-logfile -"]