FROM node:22-bookworm-slim AS build
WORKDIR /app
# Pin pnpm to the same version the repo was authored against; otherwise
# corepack resolves the latest major and behavior of postinstall-script
# enforcement changes between pnpm 10 and pnpm 12.
ENV COREPACK_DEFAULT_TO_LATEST=0
RUN corepack enable && corepack prepare pnpm@10.33.2 --activate
COPY app/package.json app/pnpm-lock.yaml app/pnpm-workspace.yaml ./
# pnpm 10 refuses to run dependency build scripts unless they are
# explicitly allow-listed. package.json `pnpm.onlyBuiltDependencies`
# covers esbuild / sharp / lightningcss / playwright / msw.
RUN pnpm install --frozen-lockfile
COPY app/ .
RUN pnpm build

FROM nginx:1.27-alpine
COPY app/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1/ || exit 1
