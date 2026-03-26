FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci --ignore-scripts
COPY . .
RUN npm run bundle

FROM node:20-alpine AS production
RUN addgroup -g 1001 -S appgroup && \
    adduser -S appuser -u 1001 -G appgroup
WORKDIR /app
COPY --from=build /app/dist ./dist
COPY --from=build /app/public ./public
COPY --from=build /app/scripts ./scripts
COPY --from=build /app/package*.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force
USER appuser
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --spider -q http://localhost:4000 || exit 1
ENTRYPOINT ["/app/scripts/docker-entrypoint.sh"]
CMD ["npm","run","serve"]
