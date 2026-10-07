# Single-stage image: no build step and no runtime dependencies.
FROM mcr.microsoft.com/devcontainers/javascript-node:1-24-bookworm

ENV NODE_ENV=production PORT=3000 DATABASE_FILE=/app/data/parts-hub.db
WORKDIR /app

COPY package.json ./
COPY src ./src
COPY public ./public

RUN mkdir -p /app/data && chown -R node:node /app
USER node
EXPOSE 3000

CMD ["node", "src/server.ts"]
