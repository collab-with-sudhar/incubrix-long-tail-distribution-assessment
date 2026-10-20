FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json tsconfig.json ./
RUN npm ci

COPY src ./src
RUN npx tsc

FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

COPY package*.json ./
RUN npm ci --only=production

COPY --from=builder /app/dist ./dist
COPY src/manifests ./dist/manifests
COPY src/manifests ./src/manifests
COPY public ./public
COPY openapi.yaml ./

EXPOSE 3000

CMD ["node", "dist/server.js"]
