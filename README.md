# AGV Dashboard

Electron desktop dashboard for ESP32-based autonomous guided vehicle.

## Setup

```bash
bun install
bunx prisma generate
bun run prisma:push
```

## Run (dev)

```bash
bun run dev
```

## Build installer

```bash
bun run dist
```

Output: `release/AGV Dashboard Setup 1.0.0.exe`

## Commands

| Script | Purpose |
|--------|---------|
| `dev` | Start dev with hot reload |
| `build` | Build app (no package) |
| `dist` | Build + create NSIS installer |
| `prisma:generate` | Regenerate Prisma client |
| `prisma:push` | Sync DB schema |
| `prisma:studio` | Open DB browser |
