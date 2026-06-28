# Stage 1: Build the Astro app (includes native module compilation)
FROM node:22-alpine AS builder

WORKDIR /app

# needed for better-sqlite3 native compilation
RUN apk add --no-cache python3 make g++

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

RUN npm run build

# Stage 2: Production runtime
FROM node:22-alpine AS runner

WORKDIR /app

# install build toolchain, compile production deps, then remove toolchain
RUN apk add --no-cache python3 make g++

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && \
    apk del python3 make g++ && \
    rm -rf /var/cache/apk/*

COPY --from=builder /app/dist ./dist
RUN mkdir -p ./data

ENV HOST=0.0.0.0
ENV PORT=4321

EXPOSE 4321

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q --spider http://localhost:4321/api/health || exit 1

CMD ["node", "dist/server/entry.mjs"]
