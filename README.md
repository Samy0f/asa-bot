# Asa Bot

A Discord bot for bookmarking images, browsing your collection, and sharing them on demand. Images are stored in Cloudflare R2 and metadata is kept in PostgreSQL.

## Features

- **Bookmark Image** — right-click a message with an image to save it with a custom name
- **Analize** — right-click a reply that says `save this as "name"` (or similar) to bookmark the image from the message it replied to
- **/asa** — save a bookmark from a Discord message link, e.g. `Save this https://discord.com/channels/... as "Shark"`
- **/list** — browse bookmarks 4 per page with numbered buttons to send an image publicly
- **/search** — find and send a bookmark by name (autocomplete)

## Requirements

- [Bun](https://bun.sh/) 1.0+
- PostgreSQL
- Cloudflare R2 bucket with public access (or a custom domain)
- Discord application with a bot user

## Setup

### 1. Clone and install

```bash
bun install
```

### 2. Environment variables

Copy the example file and fill in your values:

```bash
cp .env.example .env
```

| Variable               | Description                                 |
| ---------------------- | ------------------------------------------- |
| `DISCORD_TOKEN`        | Bot token from the Discord Developer Portal |
| `CLIENT_ID`            | Application ID                              |
| `DATABASE_URL`         | PostgreSQL connection string                |
| `R2_ACCOUNT_ID`        | Cloudflare account ID                       |
| `R2_ACCESS_KEY_ID`     | R2 API token access key                     |
| `R2_SECRET_ACCESS_KEY` | R2 API token secret                         |
| `R2_BUCKET_NAME`       | R2 bucket name                              |
| `R2_PUBLIC_URL`        | Public base URL for uploaded images         |

### 3. Discord bot settings

In the [Discord Developer Portal](https://discord.com/developers/applications):

1. **Bot → Privileged Gateway Intents** — enable **Message Content Intent**
2. Under **Installation**, enable both **Guild Install** and **User Install** if you want the bot usable in servers and as a user-installed app

### 4. Database

Run migrations:

```bash
bun run db:m
```

### 5. Register slash commands

```bash
bun run dc
```

Re-run this whenever commands change in `src/deploy-commands.ts`.

### 6. Start the bot

```bash
bun run start
```

For development with auto-reload:

```bash
bun run dev
```

## Commands

| Command                                  | Description                                                                |
| ---------------------------------------- | -------------------------------------------------------------------------- |
| `/list`                                  | Browse your bookmarks (ephemeral, paginated)                               |
| `/search`                                | Search bookmarks by name and send the image                                |
| `/asa question:...` (_dont work_)        | Save a bookmark from a message link                                        |
| **Bookmark Image** (message menu)        | Save an image from any message                                             |
| **Analize** (message menu) (_dont work_) | Parse a reply like `save this as "name"` and bookmark the referenced image |

### /asa message link format (_dont work_)

```
Save this https://discord.com/channels/GUILD_ID/CHANNEL_ID/MESSAGE_ID as "Bookmark Name"
```

DM links (`channels/@me/...`) only work if the bot can access that channel. Server channel links work when the bot is in that server.

### Analize supported phrases

On a **reply** message, right-click → **Analize**:

- `save this as "name"`
- `remember this as "name"`
- `bookmark this "name"`

## Scripts

| Script          | Description                          |
| --------------- | ------------------------------------ |
| `bun run start` | Run the bot                          |
| `bun run dev`   | Run with file watching               |
| `bun run dc`    | Deploy slash & context menu commands |
| `bun run db:g`  | Generate Drizzle migrations          |
| `bun run db:m`  | Apply migrations                     |

## Deploy on Dokploy

1. Create a new **Application** and connect this repository
2. Set **Build Type** to **Dockerfile** (uses the root `Dockerfile`)
3. Add all variables from `.env.example` in the **Environment** tab
4. Ensure PostgreSQL is reachable from the container (`DATABASE_URL`)
5. Deploy — on container start the entrypoint runs migrations and registers Discord commands (requires `DISCORD_TOKEN` and `CLIENT_ID` in env)

> Do **not** run `bun run dc` in the Dockerfile build step — env vars are only available at runtime in Dokploy.

> This bot connects outbound to Discord only — no HTTP port needs to be exposed in Dokploy.

## Project structure

```
src/
  index.ts           # Bot entry point & interaction handlers
  deploy-commands.ts # Register Discord commands
  constants.ts       # Shared constants (page size, etc.)
  responses.ts       # Bot personality / error messages
  db/                # Drizzle schema & database client
  lib/
    listUI.ts        # /list pagination UI
    r2.ts            # Cloudflare R2 uploads
    utils.ts         # Image extraction & command parsing
```
