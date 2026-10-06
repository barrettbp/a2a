FROM node:20-slim
RUN corepack enable
WORKDIR /app
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/api apps/api
RUN pnpm install --frozen-lockfile --filter @snapwork/api...
ENV NODE_ENV=production
EXPOSE 3001
CMD ["pnpm", "--filter", "@snapwork/api", "start"]
