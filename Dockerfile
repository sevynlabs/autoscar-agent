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

COPY entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh
CMD ["/app/entrypoint.sh"]
