# syntax=docker/dockerfile:1

# ---- build stage: compile the Vite/React SPA ----
FROM node:22-alpine AS builder
WORKDIR /app

# Install dependencies first so this layer is cached unless the lockfile changes.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# The API origin is baked into the bundle at build time. Default is EMPTY, which
# makes the app call "/api/..." on its OWN origin — correct behind the nginx
# tls-proxy (which proxies /api + /auth to the gateway) and domain-agnostic, so
# ONE image works for both staging and production. An empty value also removes
# the localhost:4004 fallback footgun documented in
# docs/production-readiness-review.md (P1-6): a clean rebuild can no longer
# silently ship a frontend that calls the visitor's own laptop.
#
# .env.production.local has the highest precedence in Vite, so it overrides the
# committed .env (which points at localhost for local `npm run dev`).
ARG VITE_API_BASE_URL=""
RUN printf 'VITE_API_BASE_URL=%s\n' "$VITE_API_BASE_URL" > .env.production.local \
    && npm run build

# ---- runtime stage: serve the static build with nginx ----
FROM nginx:1.27-alpine AS runner
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80
