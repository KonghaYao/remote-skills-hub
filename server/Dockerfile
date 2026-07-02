FROM denoland/deno:2 AS builder

WORKDIR /app

# Layer 1: dependencies (cached unless deno.json/deno.lock change)
COPY deno.json deno.lock ./
RUN deno install

# Layer 2: application source
COPY . .

# Deno compile check (fail fast on type errors)
RUN deno check main.ts

# --- runtime stage ---
FROM denoland/deno:2

WORKDIR /app

# Create non-root user
RUN groupadd -r deno && useradd -r -g deno deno

# Copy built deps cache from builder
COPY --from=builder /root/.cache/deno /root/.cache/deno

# Copy app files
COPY --from=builder /app /app

# Deno requires these permissions for registry proxy, tarball ops, file serving
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD deno eval "try { await fetch('http://localhost:3000/api/skills'); Deno.exit(0); } catch { Deno.exit(1); }"

ENV PORT=3000
ENV REGISTRY_URL=http://verdaccio:4873

USER deno

CMD ["deno", "task", "start"]
