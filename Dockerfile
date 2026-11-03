FROM node:24-bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 python3-venv ca-certificates libgomp1 libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
RUN npm install -g pnpm@11.25.0
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --prod --frozen-lockfile
COPY ocr/requirements.txt ./ocr/requirements.txt
RUN python3 -m venv /opt/ocr \
    && /opt/ocr/bin/pip install --no-cache-dir -r ocr/requirements.txt
COPY ocr ./ocr
RUN /opt/ocr/bin/python ocr/download-models.py --models-dir /app/ocr-models
COPY public ./public
COPY server ./server
COPY scripts ./scripts
RUN mkdir -p /app/data && chown -R node:node /app

ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000 DATA_DIR=/app/data \
    OCR_PYTHON=/opt/ocr/bin/python OCR_MODEL_DIR=/app/ocr-models \
    PYTHONDONTWRITEBYTECODE=1
USER node
EXPOSE 3000
VOLUME ["/app/data"]
HEALTHCHECK --interval=30s --timeout=3s --start-period=15s \
  CMD node -e "fetch('http://127.0.0.1:3000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server/index.mjs"]
