# Ensemble

Real-time multi-user companion to Resonance and Constellation. Two or more users with Resonance profiles converge in a session and decide what to watch, read, or play together.

Part of a paired ecosystem:

- **[Resonance](https://github.com/Drubnerw98/Resonance)** maps a user's taste DNA into a structured profile and recommends across formats.
- **[Constellation](https://github.com/Drubnerw98/Constellation)** visualizes that profile as a force-directed canvas.
- **Ensemble** (this repo) is the layer where users converge their profiles in real time.

## How it works

1. Sign in with Clerk (shared OAuth instance with Resonance and Constellation).
2. Create a session and share the 6-character code, or join an existing one by URL or code.
3. Add candidates and (eventually) vote. Live presence shows who is in the room.
4. The room code IS the Liveblocks room ID. Sessions are ephemeral for MVP.

## Stack

- **Frontend**: Vite + React 19 + TypeScript, Tailwind v4
- **Auth**: Clerk
- **Real-time sync**: Liveblocks (managed)
- **Resonance integration**: bearer-token API reads via the same Clerk session token
- **Hosting**: Vercel SPA + one Node serverless function for Liveblocks token-mint

See [`architecture.md`](./architecture.md) for the system shape and [`decisions.md`](./decisions.md) for why each piece was chosen.

## Local setup

Requires pnpm and Node 20+.

```bash
pnpm install
cp .env.local.example .env.local
# fill in VITE_CLERK_PUBLISHABLE_KEY, VITE_RESONANCE_API_URL,
# CLERK_SECRET_KEY, LIVEBLOCKS_SECRET_KEY
pnpm dev
```

## Scripts

- `pnpm dev`: Vite dev server.
- `pnpm build`: type-check + production build.
- `pnpm typecheck`: `tsc -b --noEmit` across all tsconfigs.
- `pnpm lint` / `pnpm lint:fix`: ESLint flat config.
- `pnpm format` / `pnpm format:write`: Prettier.
- `pnpm check`: typecheck + lint + build (the CI gate).

## Deploy

Vercel handles both the SPA build and the serverless function under `api/` automatically. The four env vars above must be set on the Vercel project (`VITE_*` for the build step, the others for the function runtime).

## Documentation

- [`architecture.md`](./architecture.md): system shape, data flow, module map.
- [`decisions.md`](./decisions.md): every architectural call with the reasoning. Source of truth for *why*.
- [`CLAUDE.md`](./CLAUDE.md): working rules for Claude Code in this repo.
