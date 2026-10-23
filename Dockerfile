# syntax=docker/dockerfile:1.10
FROM node:26-slim AS deps
WORKDIR /app
COPY package*.json ./
# npm ci currently fails to install rollup's optional native binaries on arm64 builders;
# npm install works around https://github.com/npm/cli/issues/4828 until the bug is fixed.
RUN npm install

FROM deps AS build
ARG SENTRY_ORG
ARG SENTRY_PROJECT
ARG SENTRY_RELEASE
ARG VITE_BACKEND_URL=http://localhost:4000
ARG VITE_PUBLIC_API_BASE_URL=http://localhost:4000/api
ARG VITE_API_DOCS_URL=http://localhost:6060
ARG VITE_DISCORD_CLIENT_ID
ARG VITE_DISCORD_REDIRECT_URI=http://localhost:5173
ARG VITE_REALTIME_URL
ENV VITE_BACKEND_URL=${VITE_BACKEND_URL}
ENV VITE_PUBLIC_API_BASE_URL=${VITE_PUBLIC_API_BASE_URL}
ENV VITE_API_DOCS_URL=${VITE_API_DOCS_URL}
ENV VITE_DISCORD_CLIENT_ID=${VITE_DISCORD_CLIENT_ID}
ENV VITE_DISCORD_REDIRECT_URI=${VITE_DISCORD_REDIRECT_URI}
ENV VITE_REALTIME_URL=${VITE_REALTIME_URL}
COPY . .
RUN npm run build
RUN --mount=type=secret,id=sentry_auth_token,env=SENTRY_AUTH_TOKEN npm run server:build

FROM node:26-slim AS runner
ARG SENTRY_RELEASE
ENV SENTRY_RELEASE=${SENTRY_RELEASE}
ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update \
    && apt-get install -y --no-install-recommends mariadb-client tini \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package*.json ./
COPY tsconfig*.json ./
COPY vite.config.ts ./
COPY index.html ./
COPY src ./src
COPY server ./server
COPY public ./public
COPY tsup.config.ts ./
COPY --from=build /app/dist ./dist
COPY --from=build /app/dist-server ./dist-server
COPY docker/entrypoint.sh ./docker/entrypoint.sh

RUN chmod +x ./docker/entrypoint.sh

EXPOSE 5173 4000

ENTRYPOINT ["/usr/bin/tini", "-g", "--"]
CMD ["/app/docker/entrypoint.sh"]
