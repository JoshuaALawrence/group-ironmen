FROM rust:1.89 AS builder
WORKDIR /app
COPY . .
RUN cargo build --release

FROM debian:bookworm-slim
RUN apt-get update && \
    apt-get install -y --no-install-recommends ca-certificates libssl3 curl && \
    rm -rf /var/lib/apt/lists/* && \
    groupadd -r appgroup && useradd -r -g appgroup -s /usr/sbin/nologin appuser
WORKDIR /app
COPY --from=builder /app/target/release/server ./
COPY --from=builder /app/collection_log_info.json ./
COPY ./docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh
USER appuser
EXPOSE 8081
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD curl -f http://localhost:8081/api/captcha-enabled || exit 1
ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["/app/server"]
