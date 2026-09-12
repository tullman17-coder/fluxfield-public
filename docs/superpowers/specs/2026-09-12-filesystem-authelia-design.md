# Fieldbench — disk filesystem + Authelia OIDC

**Status:** draft for user review  
**Date:** 2026-09-12  
**Decisions locked in chat:** library layout **C** (job folders + media library), Authelia mode **C** (OIDC into the app), Authelia hosting **A** (bring your own), access **A** (anyone Authelia authenticates), implementation approach **1** (disk-native jobs + library index + Auth.js OIDC).

## Problem

Fieldbench today keeps work in a single `.data/jobs.json` ledger (capped) and a flat `.data/outputs/` directory. That is fine for a laptop demo and wrong for a hosted studio: jobs can be truncated while files remain, nothing is browsable on disk by date or kind, sorting is “newest job only,” and there is no identity gate for a public domain.

We need:

1. A real on-disk layout that survives restarts and scales past a JSON array.
2. Sorting/filtering over both **jobs** (provenance) and a **library** (finished media).
3. Authelia as the login gate via OIDC (Fieldbench is the client; Authelia stays yours).
4. Confirmation the git tree holds no personal secrets, then an end-to-end check of what already works plus the new paths.

## Non-goals

- Bundling Authelia or a reverse proxy in this repo’s default compose (BYO Authelia).
- Multi-tenant ACLs, per-user private libraries, or an in-app allowlist (Authelia’s user list is the gate).
- Object storage / MinIO.
- Changing generation adapters, Netbird mesh setup, or model backends.
- Serverless / ephemeral disk hosting.

## Layout

```
.data/
  jobs/
    2026-09-12/
      <jobId>/
        job.json          # full job record + denormalized sort keys
        inputs/           # reference uploads for this job
        outputs/          # files this job produced
  library/
    images/2026/09/<jobId>-<safeName>.<ext>   # hard link into jobs/.../outputs/...
    audio/2026/09/...
    video/2026/09/...
    other/2026/09/...
  indexes/
    library.json          # rebuildable catalog for fast list/sort
    jobs.json             # optional thin index (id, path, tool, status, createdAt, updatedAt, label)
  settings.json
  card-bg/
  tmp/
  sessions/               # Auth.js session files if using the filesystem session strategy
```

### Job record (`job.json`)

Keeps the existing `StudioJob` fields and adds:

- `label` — short display name (preset / prompt clip)
- `outputFiles[]` — `{ name, kind, path, bytes, createdAt }` relative to the job folder
- Paths inside the record always relative to `.data/` so the volume can move

### Library entries

One library file per output that is safe to browse (images, audio, video, notable text). Hard link when the filesystem supports it; copy on filesystems that do not (document the fallback). Sidecar metadata lives only in `indexes/library.json`, not next to every media file, so a human browsing `library/images/…` sees media only.

### Index

`indexes/library.json` is a cache. `fieldbench library rebuild` (npm script / boot hook) walks `jobs/**/job.json` and regenerates it. List APIs never require the index to be perfect: if missing or stale, rebuild or fall back to a bounded walk.

## Sorting & APIs

### Jobs — `GET /api/jobs`

Query params:

| Param | Values | Default |
|---|---|---|
| `sort` | `createdAt`, `updatedAt`, `name`, `tool`, `status` | `createdAt` |
| `order` | `asc`, `desc` | `desc` |
| `tool` | dream, image2, music, director, … | (all) |
| `status` | queued, running, completed, failed | (all) |
| `limit` / `cursor` | pagination | limit 50 |

### Library — `GET /api/library`

| Param | Values | Default |
|---|---|---|
| `sort` | `createdAt`, `mtime`, `name`, `tool`, `kind` | `createdAt` |
| `order` | `asc`, `desc` | `desc` |
| `kind` | image, audio, video, other | (all) |
| `tool` | … | (all) |
| `limit` / `cursor` | pagination | limit 60 |

`GET /api/library/[...path]` serves a library object after auth (no public CDN semantics). Existing `/api/outputs/[name]` remains during migration, then redirects or resolves through the job folder.

### UI

- **Gallery** (or Library): kind chips + sort control; infinite or paged grid.
- **Job detail**: still the source of truth for prompt, settings used, and all outputs together.
- Shell shows signed-in Authelia display name / email and Sign out.

## Migration

On first boot after upgrade (and via `npm run data:migrate`):

1. If `.data/jobs.json` exists and `.data/jobs/` is empty of job folders, import each ledger entry into `jobs/<createdAt-date>/<id>/job.json`.
2. Move or link matching files from `.data/outputs/` into that job’s `outputs/` (match by `{jobId}-` filename prefix already used today).
3. Build library links + indexes.
4. Rename `jobs.json` → `jobs.json.migrated-<timestamp>` (do not delete until a later cleanup).
5. Idempotent: second run is a no-op when per-job folders already exist.

Orphan outputs (no matching job) go to `library/other/<date>/orphan-<name>` and are listed with `tool: unknown`.

## Identity (Authelia OIDC)

- **Library:** Auth.js (NextAuth v5) with a single Authelia OIDC provider.
- **Env (Fieldbench):**
  - `AUTH_SECRET`
  - `AUTH_TRUST_HOST=true` (behind TLS terminator)
  - `AUTHELIA_ISSUER` (e.g. `https://auth.example.com`)
  - `AUTHELIA_CLIENT_ID`
  - `AUTHELIA_CLIENT_SECRET`
  - `AUTHELIA_END_SESSION_URL` (optional, for SSO logout)
- **Callback:** `https://<fieldbench-host>/api/auth/callback/authelia`
- **Access rule:** any subject Authelia successfully authenticates for this client is allowed. No second allowlist in Fieldbench.
- **Route protection:** Next.js middleware requires a session for all pages and `/api/*` except:
  - `/api/auth/*`
  - `/api/health` (liveness only; no settings leakage)
  - static icons / manifest needed post-login install still go through auth on first hit (acceptable for a private studio)
- **Dev without Authelia:** `AUTH_DISABLED=true` or missing issuer keeps local `npm run dev` open on loopback only; production start refuses to boot if OIDC env is incomplete unless `AUTH_DISABLED` is set explicitly.

Authelia config lives with the operator. README ships a paste-ready `client:` snippet (authorization code + PKCE, scopes `openid profile email`, correct callback).

## Hosting surface

- Compose service `fieldbench`: build from this repo, bind-mount `./.data` → `/app/.data`, publish `43127`, `HOST=0.0.0.0`.
- No Authelia container in the default file.
- README sections: BYO Authelia client, volume backup, scrubbed Netbird examples (no concrete Tailscale peer IPs).

## Secrets hygiene (this change set)

- Scrub README example `100.115.190.105` → generic placeholder.
- Keep `.data/` gitignored; never commit `settings.json` with keys.
- `.env.example` lists OIDC variable names only.
- Pre-commit mental check: `rg` for tokens/emails before push (already clean aside from that IP).

## Verification plan

1. **Repo scan** — re-run secrets/PII ripgrep on tree + history touchpoints; confirm scrub.
2. **Migrate** — copy current `.data` aside, run migrate, assert job count, spot-check outputs linked, rebuild index.
3. **Sort** — API tests for `sort`/`order`/`kind` on jobs and library.
4. **Auth** — with OIDC env pointing at a test Authelia (or a short-lived Dex/mock issuer if Authelia is unreachable from this VM): unauthenticated request → redirect; callback establishes session; `/api/jobs` 401/redirect without cookie; signed-in gallery loads.
5. **Regression** — create dream job, lock/reload survival (`useJobWatch`), settings read/write, health, mobile shell still clean.
6. **Compose** — `docker compose config` validates; app serves on mounted volume.

## Open points (resolved in chat)

| Topic | Choice |
|---|---|
| Layout | Job folders **and** media library |
| Authelia shape | OIDC into Fieldbench (Auth.js) |
| Who runs Authelia | Bring your own |
| Who may enter | Anyone Authelia authenticates for this client |
| Index | Rebuildable JSON catalog (SQLite not required for v1) |

## Out of scope follow-ups

- Per-user libraries once a second operator appears  
- Authelia bundled `--profile auth`  
- Automatic wipe of orphan media  
- SQLite if JSON index becomes slow (>tens of thousands of files)
