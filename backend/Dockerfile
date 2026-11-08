# Build context is the backend/ folder (set Render "Root Directory" to `backend`).
FROM rust:1-slim-bookworm AS build
WORKDIR /app

# Cache dependencies: build a dummy main first so this layer only reruns when Cargo files change.
COPY Cargo.toml Cargo.lock ./
RUN mkdir src && echo "fn main() {}" > src/main.rs \
    && cargo build --release \
    && rm -rf src target/release/sulthan-holidays* target/release/deps/sulthan_holidays*

COPY src ./src
COPY migrations ./migrations
RUN cargo build --release

FROM debian:bookworm-slim
# CA certificates are needed for TLS to Neon and Google.
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/*
COPY --from=build /app/target/release/sulthan-holidays /usr/local/bin/sulthan-holidays

# Run as an unprivileged user so a bug in the API cannot become root inside the container.
RUN useradd --system --no-create-home --shell /usr/sbin/nologin app
USER app

# Render sends traffic to port 10000 by default; set BIND_ADDR=0.0.0.0:10000 in its env vars.
EXPOSE 10000
CMD ["sulthan-holidays"]
