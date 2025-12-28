FROM node:20-alpine AS base

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy prisma schema and generate client
COPY prisma ./prisma
RUN npx prisma generate

# Copy source code
COPY . .

# Build
RUN npm run build

# Strip dev dependencies after build to keep the runtime image small
RUN npm prune --omit=dev

# Production image
FROM node:20-alpine AS production

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=4000

COPY --from=base /app/dist ./dist
COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/package*.json ./
COPY --from=base /app/prisma ./prisma

# Create data directory for blockchain
RUN mkdir -p /app/data/blockchain

EXPOSE 4000

CMD ["npm", "start"]
