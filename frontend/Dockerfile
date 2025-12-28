FROM node:20-alpine AS base

WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy source
COPY . .

# Build
RUN npm run build

# Strip dev dependencies to keep runtime image small
RUN npm prune --omit=dev

# Production
FROM node:20-alpine AS production

WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000

COPY --from=base /app/.next ./.next
COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/package*.json ./
COPY --from=base /app/public ./public
COPY --from=base /app/next.config.js ./next.config.js

EXPOSE 3000

CMD ["npm", "start"]
