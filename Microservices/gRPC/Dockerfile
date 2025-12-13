# Build stage
FROM node:18-alpine AS builder

WORKDIR /app

# Install OpenSSL 1.1 for Prisma (required for linux-musl binary)
RUN apk add --no-cache openssl1.1-compat

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm ci

# Copy source files
COPY src/ ./src/
COPY proto/ ./proto/
COPY prisma/ ./prisma/

# Generate Prisma client
RUN npx prisma generate

# Build TypeScript
RUN npm run build

# Production stage
FROM node:18-alpine

WORKDIR /app

# Install OpenSSL 1.1 for Prisma (required for linux-musl binary)
RUN apk add --no-cache openssl1.1-compat

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production

# Copy built files from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# Copy proto files
COPY proto/ ./proto/

# Expose ports
EXPOSE 50051 4001

# Set environment variables
ENV NODE_ENV=production

# Start the server
CMD ["node", "dist/server.js"]


