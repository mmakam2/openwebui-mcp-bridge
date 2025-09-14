# syntax=docker/dockerfile:1
FROM node:20-alpine AS base
WORKDIR /app
COPY package.json package-lock.json* yarn.lock* pnpm-lock.yaml* ./
RUN npm i --quiet --no-progress || true
COPY tsconfig.json ./
COPY src ./src
RUN npm run build


FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/dist ./dist
COPY .env ./.env
EXPOSE 8088
CMD ["node", "dist/server.js"]