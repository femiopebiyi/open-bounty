# Build stage
FROM rust:1.95-slim as builder

WORKDIR /app

RUN apt-get update && apt-get install -y \
    pkg-config \
    libssl-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy workspace manifests
COPY Cargo.toml Cargo.lock ./

# Copy all member Cargo.toml files to satisfy workspace
COPY packages/backend/bounty-backend/Cargo.toml ./packages/backend/bounty-backend/
RUN mkdir -p packages/program/bounty-board/programs/bounty-board
COPY packages/program/bounty-board/programs/bounty-board/Cargo.toml ./packages/program/bounty-board/programs/bounty-board/

# Create dummy mains for dependency caching
RUN mkdir -p packages/backend/bounty-backend/src && \
    echo "fn main() {}" > packages/backend/bounty-backend/src/main.rs && \
    mkdir -p packages/program/bounty-board/programs/bounty-board/src && \
    echo "fn main() {}" > packages/program/bounty-board/programs/bounty-board/src/lib.rs

RUN cargo build --release -p bounty-backend
RUN rm packages/backend/bounty-backend/src/main.rs

# Copy real source
COPY packages/backend/bounty-backend/src ./packages/backend/bounty-backend/src
COPY packages/backend/bounty-backend/migrations ./packages/backend/bounty-backend/migrations
COPY packages/backend/bounty-backend/.sqlx ./packages/backend/bounty-backend/.sqlx

ENV SQLX_OFFLINE=true

RUN touch packages/backend/bounty-backend/src/main.rs && \
    cargo build --release -p bounty-backend

# Runtime stage
FROM debian:bookworm-slim

WORKDIR /app

RUN apt-get update && apt-get install -y \
    ca-certificates \
    libssl3 \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/target/release/bounty-backend .
COPY --from=builder /app/packages/backend/bounty-backend/migrations ./migrations

EXPOSE 3000

CMD ["./bounty-backend"]
