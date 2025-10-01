# Google Cloud Run Worker for NOFX Gate Execution
# This worker runs continuously to process gate steps (typecheck, lint, tests, etc.)
# that cannot run in Vercel's serverless environment

FROM node:20-slim

# Install zx and other dependencies needed for gate execution
RUN apt-get update && apt-get install -y \
    git \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./

# Install dependencies (all deps, not just production)
RUN npm install

# Copy source code
COPY . .

# Create directory for gate artifacts
RUN mkdir -p gate-artifacts

# Expose port (Cloud Run requires this)
EXPOSE 8080

# Run the worker using tsx to handle TypeScript
CMD ["npx", "tsx", "src/worker/cloud-main.js"]
