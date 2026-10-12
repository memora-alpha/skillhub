# syntax=docker/dockerfile:1
FROM node:22-bookworm-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates openssl \
    && rm -rf /var/lib/apt/lists/* \
    && corepack enable \
    && corepack prepare pnpm@10.24.0 --activate
WORKDIR /app

FROM base AS builder
RUN apt-get update \
    && apt-get install -y --no-install-recommends g++ make python3 \
    && rm -rf /var/lib/apt/lists/*
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY packages ./packages
COPY services/api/package.json ./services/api/package.json
RUN HUSKY=0 CI=true DATABASE_URL=postgresql://localhost/build_only pnpm install --frozen-lockfile \
    && mkdir -p services/api/node_modules
COPY services/api ./services/api
RUN DATABASE_URL=postgresql://localhost/build_only pnpm --filter api build

# Dev image: keep Prisma CLI for the migration/bootstrap step before API startup.
FROM base AS runner
ENV NODE_ENV=development
ENV PORT=3001
COPY --from=builder /app/package.json /app/pnpm-workspace.yaml /app/.npmrc ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/services/api/package.json ./services/api/package.json
COPY --from=builder /app/services/api/node_modules ./services/api/node_modules
COPY --from=builder /app/services/api/dist ./services/api/dist
COPY --from=builder /app/services/api/prisma ./services/api/prisma
COPY --from=builder /app/services/api/prisma.config.ts ./services/api/prisma.config.ts
COPY --from=builder /app/services/api/scripts ./services/api/scripts
COPY --from=builder /app/services/api/release-seeds.json ./services/api/release-seeds.json
RUN mkdir /release-state && chown node:node /release-state
WORKDIR /app/services/api
USER node
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=120s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3001)+'/api/health/ready').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "scripts/start-api.mjs"]
