# Build from the project root:  docker build -f backend/Dockerfile .

# ---- Stage 1: install Python packages ----
FROM python:3.12-slim AS builder
ENV PIP_NO_CACHE_DIR=1
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"
WORKDIR /build
# CPU-only PyTorch is much smaller (the server has no GPU)
RUN pip install torch --index-url https://download.pytorch.org/whl/cpu
COPY backend/requirements.txt .
RUN pip install -r requirements.txt

# ---- Stage 2: final image ----
FROM python:3.12-slim
ENV PATH="/opt/venv/bin:$PATH" \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright \
    HF_HOME=/opt/hf \
    DATA_DIR=/data

COPY --from=builder /opt/venv /opt/venv

# Chromium (for website scraping) and the embedding model are downloaded now,
# so the first user request does not have to wait.
RUN playwright install --with-deps chromium \
    && python -c "from transformers import AutoModel, AutoTokenizer; n='BAAI/bge-small-en-v1.5'; AutoTokenizer.from_pretrained(n); AutoModel.from_pretrained(n)"

# Run as a normal user, not root
RUN useradd --create-home app && mkdir /data && chown app:app /data
WORKDIR /app
COPY backend ./backend
USER app

EXPOSE 8000
# ONE worker only: the FAISS files and locks are not safe for several processes
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
