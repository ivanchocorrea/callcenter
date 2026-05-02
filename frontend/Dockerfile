FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm install --no-audit --no-fund

FROM node:20-alpine AS builder
WORKDIR /app
ARG NEXT_PUBLIC_API_URL=https://app.somoscallcenter.com
ARG NEXT_PUBLIC_WS_URL=wss://app.somoscallcenter.com
ARG NEXT_PUBLIC_SIP_WSS_URL=wss://app.somoscallcenter.com:8089/ws
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_WS_URL=$NEXT_PUBLIC_WS_URL
ENV NEXT_PUBLIC_SIP_WSS_URL=$NEXT_PUBLIC_SIP_WSS_URL
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# NODE_OPTIONS aumenta el heap de V8 a 4 GB (default 1.5 GB) — Next.js
# en proyectos grandes se queda sin memoria al hacer type-check + build.
# Si tu VPS tiene < 4 GB RAM libre, baja este número o agrega swap.
ENV NODE_OPTIONS=--max-old-space-size=4096
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN apk add --no-cache tini

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3000
ENTRYPOINT ["/sbin/tini","--"]
CMD ["node","server.js"]
