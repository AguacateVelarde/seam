# Vite env vars are baked in at build time — pass them as build args.
FROM oven/bun:1 AS build
WORKDIR /app
ARG VITE_SEAM_SERVER_URL=http://localhost:3000
ARG VITE_SEAM_ADMIN_KEY=
ENV VITE_SEAM_SERVER_URL=$VITE_SEAM_SERVER_URL
ENV VITE_SEAM_ADMIN_KEY=$VITE_SEAM_ADMIN_KEY
COPY package.json bun.lock turbo.json ./
COPY apps/server/package.json ./apps/server/
COPY apps/studio/package.json ./apps/studio/
COPY packages/schema/package.json ./packages/schema/
COPY packages/adapter-stac/package.json ./packages/adapter-stac/
COPY packages/adapter-divkit/package.json ./packages/adapter-divkit/
COPY packages/sdk-js/package.json ./packages/sdk-js/
RUN bun install --frozen-lockfile
COPY . .
RUN cd apps/studio && bun run build

FROM nginx:1.27-alpine AS release
COPY --from=build /app/apps/studio/dist /usr/share/nginx/html
COPY apps/studio/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
