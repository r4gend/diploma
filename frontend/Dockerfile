# =========================================================================
# Frontend Dockerfile - React 18 + Vite + Tailwind, served by nginx
# Build context: ./frontend
# =========================================================================

# ---- Stage 1: build the static bundle --------------------------------------
FROM node:20-alpine AS builder

WORKDIR /app

# Install deps using the lockfile for reproducible builds
COPY package.json package-lock.json ./
RUN npm ci

# Build the production bundle
COPY . .

# VITE_API_URL is baked into the JS at build time.
# Defaults to "/api" so nginx can reverse-proxy to the backend.
ARG VITE_API_URL=/api
ENV VITE_API_URL=$VITE_API_URL

RUN npm run build


# ---- Stage 2: nginx static server ------------------------------------------
FROM nginx:1.27-alpine AS runtime

# Replace default nginx config with one that:
#   - serves the SPA (with HTML5 history fallback)
#   - reverse-proxies /api -> backend container
RUN rm /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built static assets from the builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -q --spider http://localhost/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
