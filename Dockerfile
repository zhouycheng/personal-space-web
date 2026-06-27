# Stage 1: Build the Astro app (includes native module compilation)
FROM node:22-alpine AS builder

WORKDIR /app

# use Aliyun mirror for faster apk in China
RUN sed -i 's/dl-cdn.alpinelinux.org/mirrors.aliyun.com/g' /etc/apk/repositories

# needed for better-sqlite3 native compilation
RUN apk add --no-cache python3 make g++

COPY package.json package-lock.json ./
RUN npm config set registry https://registry.npmmirror.com && npm ci

COPY . .

# Build-time env vars needed by Astro SSR (from compose build args)
ARG CANVAS_SALT
ARG CANVAS_ENCRYPTED_TOKEN
ARG CANVAS_AUTH_TOKEN
ENV CANVAS_SALT=${CANVAS_SALT}
ENV CANVAS_ENCRYPTED_TOKEN=${CANVAS_ENCRYPTED_TOKEN}
ENV CANVAS_AUTH_TOKEN=${CANVAS_AUTH_TOKEN}

RUN npm run build

# Stage 2: Production runtime
FROM node:22-alpine AS runner

WORKDIR /app

# use Aliyun mirror for faster apk in China
RUN sed -i 's/dl-cdn.alpinelinux.org/mirrors.aliyun.com/g' /etc/apk/repositories

# install build toolchain, compile production deps, then remove toolchain
RUN apk add --no-cache python3 make g++

COPY package.json package-lock.json ./
RUN npm config set registry https://registry.npmmirror.com && \
    npm ci --omit=dev && \
    apk del python3 make g++ && \
    rm -rf /var/cache/apk/*

COPY --from=builder /app/dist ./dist
COPY data/ ./data/

ENV HOST=0.0.0.0
ENV PORT=4321

EXPOSE 4321

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q --spider http://localhost:4321/ || exit 1

CMD ["node", "dist/server/entry.mjs"]
