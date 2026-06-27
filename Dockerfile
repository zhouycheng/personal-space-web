FROM node:22-alpine

WORKDIR /app

COPY dist/ ./dist/
COPY data/ ./data/

ENV HOST=0.0.0.0
ENV PORT=4321

EXPOSE 4321

CMD ["node", "dist/server/entry.mjs"]
