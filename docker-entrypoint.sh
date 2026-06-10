#!/bin/sh
set -e

if [ -n "$DATABASE_URL" ]; then
  bun run db:m
fi

exec bun run start
