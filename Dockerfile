FROM node:22-bookworm AS base

# Install Playwright Chromium system dependencies
RUN npx playwright install-deps chromium && npx playwright install chromium

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy source and build
COPY . .
RUN npx prisma generate
RUN npm run build

# Production
ENV NODE_ENV=production
EXPOSE 3000

CMD npx prisma db push --skip-generate --accept-data-loss 2>&1 || echo "prisma db push failed, starting app anyway"; node dist/main.js
