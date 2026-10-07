FROM node:20-slim
RUN corepack enable
WORKDIR /app
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/api apps/api
# Production dependencies only. tsx is a runtime dependency because the shared package ships TypeScript source.
RUN pnpm install --frozen-lockfile --prod --filter @snapwork/api...
ENV NODE_ENV=production
WORKDIR /app/apps/api
USER node
EXPOSE 3001
# No pnpm at runtime (it would need to download itself as the non-root user).
CMD ["./node_modules/.bin/tsx", "src/index.ts"]
