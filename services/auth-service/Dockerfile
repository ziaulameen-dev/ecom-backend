# Multi-stage build for the auth-service. Build context = this service folder.
# See docs/DOCKER_SETUP.md for the reasoning behind each stage.

# ---- deps: install ALL deps (needed to compile TypeScript) -------------------
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile

# ---- builder: compile TypeScript -> dist/ ------------------------------------
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN yarn build

# ---- runner: lean production image -------------------------------------------
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Only production deps in the final image.
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile --production && yarn cache clean
COPY --from=builder /app/dist ./dist

# Drop root for runtime.
RUN chown -R node:node /app
USER node

EXPOSE 3009

HEALTHCHECK --interval=30s --timeout=3s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://localhost:3009/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/main.js"]
