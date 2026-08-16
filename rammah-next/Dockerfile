FROM node:24.14.0-alpine AS builder

WORKDIR /app
COPY package.json package-lock.json ./
COPY rammah-api/package.json rammah-api/package.json
COPY rammah-next/package.json rammah-next/package.json
RUN npm ci

COPY . .
ARG NEXT_PUBLIC_API_BASE_URL
ARG NEXT_PUBLIC_SITE_URL
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
RUN npm run build --workspace=rammah-next

FROM node:24.14.0-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production HOSTNAME=0.0.0.0 PORT=3000
COPY --from=builder --chown=node:node /app/rammah-next/.next/standalone ./
COPY --from=builder --chown=node:node /app/rammah-next/public ./rammah-next/public
COPY --from=builder --chown=node:node /app/rammah-next/.next/static ./rammah-next/.next/static
USER node
EXPOSE 3000
CMD ["node", "rammah-next/server.js"]
