FROM oven/bun:1.3-debian

WORKDIR /app

COPY .npmrc package.json bun.lock* ./
RUN bun install --frozen-lockfile

COPY . .
RUN bun run dc

CMD ["bun", "run", "start"]
