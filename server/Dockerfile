FROM node:22-bookworm-slim AS build
WORKDIR /app
# Pin pnpm to the same version the repo was authored against; otherwise
# corepack resolves the latest major and behavior of postinstall-script
# enforcement changes between pnpm 10 and pnpm 12.
ENV COREPACK_DEFAULT_TO_LATEST=0
RUN corepack enable && corepack prepare pnpm@10.33.2 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
# pnpm 10 refuses to run dependency build scripts unless they are
# explicitly allow-listed. package.json `pnpm.onlyBuiltDependencies`
# covers esbuild and the mssql native module.
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
ENV COREPACK_DEFAULT_TO_LATEST=0
RUN corepack enable && corepack prepare pnpm@10.33.2 --activate
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --prod --frozen-lockfile
COPY --from=build /app/dist ./dist
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:4000/healthz').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["node", "--env-file-if-exists=.env", "dist/index.js"]
