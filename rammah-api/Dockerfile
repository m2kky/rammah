FROM node:24.14.0-alpine

WORKDIR /app
COPY --chown=node:node package.json package-lock.json ./
COPY --chown=node:node rammah-api/package.json rammah-api/package.json
COPY --chown=node:node rammah-next/package.json rammah-next/package.json
RUN npm ci

COPY --chown=node:node rammah-api rammah-api
RUN npm run build --workspace=rammah-api

ENV NODE_ENV=production
USER node
EXPOSE 4000
CMD ["npm", "run", "start", "--workspace=rammah-api"]
