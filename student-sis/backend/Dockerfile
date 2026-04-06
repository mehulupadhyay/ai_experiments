FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache openssl

# Development stage
FROM base AS development
COPY package*.json ./
RUN npm install
COPY . .
RUN npx prisma generate
EXPOSE 4000
CMD ["npm", "run", "dev"]

# Build stage
FROM base AS builder
COPY package*.json ./
RUN npm install --omit=dev
COPY . .
RUN npx prisma generate

# Production stage
FROM base AS production
ENV NODE_ENV=production
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/src ./src
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package.json ./
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001
USER nodejs
EXPOSE 4000
CMD ["node", "src/index.js"]
