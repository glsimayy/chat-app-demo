# syntax=docker/dockerfile:1

FROM node:22-alpine AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci

FROM dependencies AS build
COPY prisma ./prisma
RUN npm run prisma:generate
COPY nest-cli.json tsconfig.json tsconfig.build.json ./
COPY src ./src
COPY scripts ./scripts
RUN npm run build

FROM build AS migration
CMD ["sh", "-c", "npx prisma migrate deploy && npm run db:audit"]

FROM build AS production-dependencies
RUN npm prune --omit=dev

FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=production-dependencies --chown=node:node /app/package.json ./package.json
COPY --from=production-dependencies --chown=node:node /app/node_modules ./node_modules
COPY --from=production-dependencies --chown=node:node /app/dist ./dist
COPY --from=production-dependencies --chown=node:node /app/prisma ./prisma

USER node
EXPOSE 3000
CMD ["node", "dist/main.js"]
