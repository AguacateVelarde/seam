FROM oven/bun:1 AS base
WORKDIR /app

FROM base AS install
COPY package.json bun.lock turbo.json ./
COPY apps/server/package.json ./apps/server/
COPY apps/studio/package.json ./apps/studio/
COPY packages/schema/package.json ./packages/schema/
COPY packages/adapter-stac/package.json ./packages/adapter-stac/
COPY packages/adapter-divkit/package.json ./packages/adapter-divkit/
COPY packages/sdk-js/package.json ./packages/sdk-js/
RUN bun install --frozen-lockfile

FROM base AS build
# Copy the whole install-stage tree: bun nests some deps inside per-package
# node_modules (apps/*/node_modules, packages/*/node_modules), so copying
# only the root node_modules breaks resolution on a clean CI checkout.
COPY --from=install /app /app
COPY . .
RUN cd apps/server && bun run build

FROM oven/bun:1-slim AS release
WORKDIR /app
COPY --from=build /app/apps/server/dist ./dist
COPY --from=build /app/apps/server/src/db/migrations ./migrations
COPY --from=build /app/apps/server/package.json .
ENV SEAM_AUTO_MIGRATE=true
ENV SEAM_MIGRATIONS_DIR=./migrations
EXPOSE 3000
CMD ["bun", "dist/index.js"]
