# ─────────────────────────────────────────────────────────────
# MintMoment — minimal Node 20 runtime for Render Docker deploy
# ─────────────────────────────────────────────────────────────
FROM node:20-alpine

WORKDIR /app

# Install only production deps
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --omit=optional --no-audit --no-fund

# Copy the rest
COPY src ./src
COPY scripts ./scripts

ENV NODE_ENV=production
ENV PORT=10000

EXPOSE 10000

# Health check (Render also does this via /health, but keep this for safety)
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:10000/health || exit 1

CMD ["node", "src/server.js"]
