# =========================================================================
# Backend Dockerfile - FastAPI + SQLAlchemy (async) + PostgreSQL
# Build context: ./backend
# =========================================================================

# ---- Stage 1: builder -------------------------------------------------------
FROM python:3.11-slim AS builder

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# System deps required to build wheels (psycopg2, asyncpg, numpy, etc.)
RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential \
        gcc \
        libpq-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /build

# Install dependencies into a dedicated prefix that we'll copy into the runtime
COPY requirements.txt .
RUN pip install --prefix=/install --no-cache-dir -r requirements.txt


# ---- Stage 2: runtime -------------------------------------------------------
FROM python:3.11-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app \
    PATH="/usr/local/bin:$PATH"

# Runtime libs only (libpq for psycopg2, curl for healthcheck)
RUN apt-get update && apt-get install -y --no-install-recommends \
        libpq5 \
        curl \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --system app && useradd --system --gid app --home /app app

# Copy installed packages from builder
COPY --from=builder /install /usr/local

WORKDIR /app

# Copy application source
COPY --chown=app:app . /app

USER app

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD curl -fsS http://localhost:8000/api/health || exit 1

# Production-style start: no --reload, multiple workers
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
