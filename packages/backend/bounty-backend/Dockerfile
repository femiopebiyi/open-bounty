# Build stage
FROM rust:1.95-slim as builder

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    pkg-config \
    libssl-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy manifests first for layer caching
COPY Cargo.toml Cargo.lock ./

# Create dummy main to cache dependencies
RUN mkdir src && echo "fn main() {}" > src/main.rs
RUN cargo build --release
RUN rm src/main.rs

# Copy real source
COPY src ./src
COPY migrations ./migrations

# Build the real binary
RUN touch src/main.rs && cargo build --release

# Runtime stage — minimal image
FROM debian:bookworm-slim

WORKDIR /app

RUN apt-get update && apt-get install -y \
    ca-certificates \
    libssl3 \
    && rm -rf /var/lib/apt/lists/*

# Copy binary from builder
COPY --from=builder /app/target/release/bounty-backend .

# Copy migrations so sqlx can run them on startup
COPY --from=builder /app/migrations ./migrations

EXPOSE 3000

CMD ["./bounty-backend"]