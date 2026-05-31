# AGENTS.md

Guidance for AI agents working in this repository.

## Project overview

Discord (and optional Telegram stub) bot for a game community server. Built with **NestJS 11**, **TypeScript**, **SQLite** (TypeORM + better-sqlite3), **discord.js v14**, **Vitest**.

There is **no HTTP server** — the app boots via `NestFactory.createApplicationContext` in [`src/main.ts`](src/main.ts).

Legacy v1 bot lives in [`v1/`](v1/) (reference only; do not extend unless asked).

## Architecture

Feature-based layout:

```
src/
  modules/<feature>/     # Business logic + feature module
    *.service.ts         # Domain services
    discord/             # Discord adapters (commands, gateway, presenter)
    tg/                  # Telegram stubs (grammy composers)
  platforms/
    discord/             # Shared Discord client, command routing
    telegram/            # Shared Telegram service
  database/
    entities/            # TypeORM entities
    migrations/          # Versioned migrations (migrationsRun: true)
  config/                # Nest config (configuration.ts)
scripts/
  deploy-discord-commands.ts   # Register slash commands with Discord API
  import-v1-db.ts              # One-off lowdb import
test/
  helpers/               # Mocks (discord, typeorm, config)
  setup.ts
```

### Layering rules

1. **Domain logic** stays in `modules/<feature>/*.service.ts` — no discord.js imports.
2. **Discord UI** in `modules/<feature>/discord/` — commands parse interactions, presenters format messages, gateways handle events.
3. **Platforms** provide shared infrastructure (`DiscordService.registerCommand`, client lifecycle).
4. New slash commands require **both**:
   - Handler registered in a `*.discord.commands.ts` `onModuleInit`
   - Definition in [`scripts/deploy-discord-commands.ts`](scripts/deploy-discord-commands.ts), then `npm run deploy:discord-commands`

### Features

| Module | Purpose |
|--------|---------|
| `onboarding` | Emoji → role rules, reaction handlers |
| `rolling` | `/roll`, `/rolls`, `/roll-channel` |
| `leaderboard` | Rating matches (Bo1–Bo5 with rounds), tiers, top, admin setup |

## Code conventions

- **ESM + NodeNext**: relative imports use `.js` extension (e.g. `./foo.service.js`).
- **Minimal diffs**: match existing naming, Nest `@Injectable()`, one concern per file.
- **Errors to users** (Discord): generic `"Произошла ошибка"` via [`replyWithUserError`](src/platforms/discord/discord-interaction.util.ts); log details server-side.
- **No `synchronize: true`** — always add a migration in `src/database/migrations/` and register it in [`database.module.ts`](src/database/database.module.ts).
- **Do not commit** `.env`, tokens, or SQLite DB files.
- **Do not edit** plan files in `.cursor/plans/` unless the user asks.
- **Tests**: Vitest (`npm run test`). Co-locate specs as `*.spec.ts`. Use helpers in `test/helpers/`.

## Environment

Copy [`.env.example`](.env.example):

| Variable | Purpose |
|----------|---------|
| `DISCORD_TOKEN` | Bot token |
| `DISCORD_APP_ID` or `APP_ID` | Application ID for slash command deploy |
| `DB_PATH` | SQLite file path (default `./data/bot.sqlite`) |
| `TELEGRAM_BOT_TOKEN` | Optional; empty disables Telegram |
| `SPECIAL_USERNAMES`, `SPECIAL_FLAGS` | Rolling module easter-eggs |

## Discord bot setup (for testing)

1. Enable **Server Members Intent** in Discord Developer Portal.
2. Bot role must be **above** managed rating roles and have **Manage Roles**.
3. After changing slash commands: `npm run deploy:discord-commands`.

## Leaderboard specifics

- **Match series**: `RatingMatch` + child `RatingMatchRound` (map + round winner per row).
- **Series result** derived by [`LeaderboardSeriesService`](src/modules/leaderboard/leaderboard-series.service.ts) — do not accept winner/loser from Discord for multi-round formats.
- **Rating** applied once per verified series; `winnerScore`/`loserScore` passed to [`LeaderboardRatingService`](src/modules/leaderboard/leaderboard-rating.service.ts) (stub ±1 today).
- **Verification**: reaction on match message (`GuildMessageReactions` + partials).

## Common commands

```bash
npm install
npm run start:dev          # Watch mode
npm run build              # Compile to dist/
npm run test               # Vitest
npm run lint               # ESLint
npm run deploy:discord-commands
npm run migration:import-v1-db
```

## Adding a new feature module

1. Create `src/modules/<name>/` with service, module, types.
2. Add `discord/<name>.discord.commands.ts` (and gateway/presenter if needed).
3. Register module in [`src/app.module.ts`](src/app.module.ts).
4. Add entities + migration if persistence is needed.
5. Add Vitest specs for services and Discord adapters.
6. Add slash commands to deploy script and wire handlers.

## What to avoid

- Putting business rules in Discord command handlers (parse → call service → present).
- Duplicating slash command definitions only in code without updating `deploy-discord-commands.ts`.
- Using Jest (project uses Vitest).
- Force-push, amending commits, or committing without user request.
- Large refactors or README churn unless requested.
