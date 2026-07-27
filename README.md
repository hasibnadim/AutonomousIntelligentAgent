# User Admin

Electron desktop app for admin/user CRUD + ESP32 biometric pattern auth (SQLite + Prisma).

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

Default login: `admin` / `admin123`

## ESP32 biometric socket (`TCP :9000`)

All messages are newline-terminated text fields separated by `:`. JSON is not accepted.

| Step | Send | Response |
|------|------|----------|
| 1. Lookup by keypad user id | `LOOKUP:1` | `LOOKUP:1:SET` or `LOOKUP:1:GET` |
| 2a. Enroll pattern (SET) | `SET:1:1478` | `SET:1:OK` |
| 2b. Verify pattern (GET) | `GET:1:1478` | `GET:1:1` or `GET:1:0` |

- **SET** = no pattern stored yet → ESP collects pattern and saves it  
- **GET** = pattern exists → final field is `1` for verified or `0` for unverified
- Errors use `ERROR:<CODE>`, for example `ERROR:NOT_FOUND`
- Patterns are stored hashed (never returned to clients)

TCP :9000 is the only network service. Admin/user CRUD happens inside the app over Electron IPC.

## Commands

| Script | Purpose |
|--------|---------|
| `dev` | Start dev with hot reload |
| `build` | Build app (no package) |
| `dist` | Build + create NSIS installer |
| `prisma:generate` | Regenerate Prisma client |
| `prisma:push` | Sync DB schema |
| `prisma:seed` | Seed/reset admin |
| `prisma:studio` | Open DB browser |
