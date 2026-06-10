#!/bin/sh
set -e

if [ -n "$DATABASE_URL" ]; then
  bun run db:m
fi

if [ -n "$DISCORD_TOKEN" ] && [ -n "$CLIENT_ID" ]; then
  bun run dc
fi

exec bun run start
