# syntax=docker/dockerfile:1

FROM node:22-alpine AS frontend-builder
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
ARG VITE_ALTCLOUD_API_BASE_URL=
ARG VITE_ALTCLOUD_API_DEV_USER_EMAIL=super.admin@intranet.local
ENV VITE_ALTCLOUD_API_BASE_URL=${VITE_ALTCLOUD_API_BASE_URL}
ENV VITE_ALTCLOUD_API_DEV_USER_EMAIL=${VITE_ALTCLOUD_API_DEV_USER_EMAIL}
RUN npm run build

FROM node:22-alpine AS backend-builder
WORKDIR /app

COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

COPY server ./server
COPY tsconfig.json tsconfig.app.json tsconfig.node.json ./
RUN npm run prisma:generate && npm run build:server

FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV SERVER_HOST=0.0.0.0
ENV SERVER_PORT=3001
ENV STATIC_WEB_ROOT=/app/dist
ENV MEDIA_STORAGE_ROOT=/app/runtime-media

COPY package.json package-lock.json ./
COPY prisma ./prisma
COPY docker ./docker
RUN npm ci --omit=dev && npm install --no-save prisma@6.8.2 tsx@4.19.4 && npx prisma generate

COPY --from=backend-builder /app/server/dist ./server/dist
COPY --from=frontend-builder /app/dist ./dist
COPY docker/entrypoint.sh /entrypoint.sh

RUN chmod +x /entrypoint.sh && mkdir -p /app/runtime-media

EXPOSE 3001

ENTRYPOINT ["/entrypoint.sh"]
