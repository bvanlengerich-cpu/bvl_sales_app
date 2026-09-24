FROM node:24-bookworm-slim

WORKDIR /app
RUN npm install -g pnpm@11.25.0
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --prod --frozen-lockfile
COPY public ./public
COPY server ./server
COPY scripts ./scripts
RUN mkdir -p /app/data && chown -R node:node /app

ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000 DATA_DIR=/app/data
USER node
EXPOSE 3000
VOLUME ["/app/data"]
HEALTHCHECK --interval=30s --timeout=3s --start-period=15s \
  CMD node -e "fetch('http://127.0.0.1:3000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server/index.mjs"]
