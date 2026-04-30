# ---------- builder ----------
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
# npm install funciona aunque no exista package-lock.json
RUN npm install --no-audit --no-fund
COPY tsconfig*.json nest-cli.json ./
COPY src ./src
RUN npm run build

# ---------- runtime ----------
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
RUN apk add --no-cache wget tini
COPY package*.json ./
RUN npm install --omit=dev --no-audit --no-fund && npm cache clean --force
COPY --from=builder /app/dist ./dist

EXPOSE 3001
ENTRYPOINT ["/sbin/tini","--"]
CMD ["node","dist/main.js"]
