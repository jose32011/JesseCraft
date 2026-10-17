# Pokémon Arena

Pokémon Arena is a mobile-friendly multiplayer lobby and battle experience where an admin creates player codenames, players draft seven Pokémon, and two trainers meet in a cinematic stadium match.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Optional env: `DATABASE_URL` — Postgres connection string; without it, the API uses a persistent embedded database under `.data/pokemon-arena`

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/pokemon-arena/src/App.tsx` — player lobby, team draft, battle arena, and admin dashboard UI.
- `artifacts/pokemon-arena/src/index.css` — shared midnight-stadium theme, typography, motion, and responsive layout.
- `artifacts/api-server/src/routes/pokemon.ts` — player, lobby, team, battle, and dashboard API routes.
- `lib/api-spec/openapi.yaml` — source of truth for generated API hooks and validation.
- `lib/db/src/schema/players.ts` and `lib/db/src/schema/lobbies.ts` — persistent player and lobby models.

## Architecture decisions

- The player flow is intentionally mobile-first while the control room is desktop-friendly.
- Pokémon artwork comes from PokeAPI's official artwork URLs; supplied battle images anchor the arena presentation.
- Lobby state is persisted in PostgreSQL so room codes and team readiness survive separate mobile sessions.

## Product

- Players choose an admin-created codename, discover or create a room, join an opponent, draft exactly seven Pokémon, and launch a battle.
- Admins can add/remove players, monitor open rooms, and see player, lobby, readiness, and battle summary metrics.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- After changing `lib/api-spec/openapi.yaml`, run `pnpm --filter @workspace/api-spec run codegen`.
- The API server uses the seeded player roster on first read; its seed initialization is single-flight to avoid concurrent request races.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
