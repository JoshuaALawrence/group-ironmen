FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json tsconfig.json ./
RUN npm ci --ignore-scripts
COPY src/ ./src/
RUN npx tsc && cd src/site && node build.js --prod

FROM node:20-alpine AS production
RUN addgroup -g 1001 -S appgroup && \
    adduser -S appuser -u 1001 -G appgroup
WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

# Copy compiled server JS
COPY --from=build /app/dist/server ./dist/server
COPY collection_log_info.json ./

# Copy built frontend assets
COPY --from=build /app/src/site/public ./src/site/public

USER appuser
EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget --spider -q http://localhost:4000/api/captcha-enabled || exit 1

CMD ["node", "dist/server/index.js"]
