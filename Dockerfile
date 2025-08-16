# Pure API Service - No Browser Dependencies
FROM node:20-alpine

# Install minimal system dependencies
RUN apk add --no-cache \
    sqlite \
    curl \
    python3 \
    make \
    g++ \
    && rm -rf /var/cache/apk/*

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY pnpm-lock.yaml* ./

# Install pnpm and dependencies
RUN npm install -g pnpm@latest
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Create necessary directories
RUN mkdir -p /app/logs
RUN mkdir -p /app/data

# Build standalone server
RUN npm run build:standalone

# Expose ports
EXPOSE 8787 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8787/ || exit 1

# Default command - can be overridden for different modes
CMD ["npm", "run", "dev:standalone"]
