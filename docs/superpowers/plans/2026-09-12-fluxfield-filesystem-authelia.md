# Fluxfield Filesystem + Authelia OIDC Implementation Plan

> **For agentic workers:** Execute task-by-task. Steps use checkbox (`- [ ]`) syntax. User granted authority to use the agent's highest-confidence defaults for any open question.

**Goal:** Replace the flat `.data/jobs.json` ledger with per-job folders plus a sorted media library, gate the app with Authelia via Auth.js OIDC, keep the Fluxfield name everywhere, and verify the studio still works end-to-end.

**Architecture:** Jobs live at `.data/jobs/<yyyy-mm-dd>/<id>/job.json` with sibling `inputs/` and `outputs/`. Finished media is hard-linked (copy fallback) into `.data/library/<kind>/<yyyy>/<mm>/`. A rebuildable `.data/indexes/library.json` powers sorted list APIs. Auth.js (NextAuth v5) is the only OIDC client; Authelia stays outside the compose file. `AUTH_DISABLED=true` keeps loopback/dev and this cloud VM testable without a live Authelia.

**Tech Stack:** Next.js 16 App Router, Auth.js (`next-auth@5`), Node `fs` hard links, existing Zod/nanoid, no SQLite in v1.

## Global Constraints

- Shipped name is **Fluxfield** on every user- and developer-facing surface (`package.json` name `fluxfield`).
- Data root remains **`.data/`** (existing volume; do not rename to `.data`).
- Copy tone: product language only — no implementation jargon in UI strings.
- BYO Authelia; anyone Authelia authenticates for this client is allowed.
- Do not commit secrets; scrub concrete Tailscale peer IPs from docs.
- Prefer hard links for library files; fall back to copy when `link` fails.
- Production boot without OIDC env fails unless `AUTH_DISABLED=true`.

## Defaults locked by authority grant

| Question | Choice |
|---|---|
| Execution style | Inline in this session (fastest path to working software) |
| Session strategy | Auth.js JWT sessions (no DB) |
| Dev bypass | `AUTH_DISABLED=true` on loopback / this VM for e2e |
| Library kinds | `image`, `audio`, `video`, `other` (maps from JobOutput.kind) |
| Job list API | Extend `GET /api/jobs` with `sort`, `order`, `tool`, `status`, `limit` |
| Gallery UI | Add sort/kind controls on `/gallery` consuming `/api/library` |
| Output URL compat | Keep `/api/outputs/[name]` resolving from job folders + legacy flat dir |

## File map

| Path | Role |
|---|---|
| `src/lib/data/paths.ts` | `.data` roots |
| `src/lib/jobs/store.ts` | Rewrite: folder CRUD, list/sort, migrate |
| `src/lib/library/index.ts` | Catalog rebuild, list/sort, link helpers |
| `src/lib/library/kinds.ts` | kind mapping |
| `src/app/api/library/route.ts` | Sorted library list |
| `src/app/api/library/[...path]/route.ts` | Authenticated media serve |
| `src/app/api/outputs/[name]/route.ts` | Resolve legacy + job-folder files |
| `src/app/api/jobs/route.ts` | Sort query params |
| `src/app/gallery/page.tsx` | Sort/kind UI |
| `src/auth.ts`, `src/app/api/auth/[...nextauth]/route.ts`, `src/middleware.ts` | Authelia OIDC |
| `src/app/api/health/route.ts` | Public liveness (or rename from existing) |
| `.env.example`, `README.md`, `docker-compose.yml` | Fluxfield + OIDC docs |
| `scripts/migrate-data.mjs` | CLI migrate/rebuild |
| `package.json` | `data:migrate`, `data:rebuild-library`, next-auth dep |

---

### Task 1: Data paths + folder job store + migration

**Files:**
- Create: `src/lib/data/paths.ts`
- Create: `scripts/migrate-data.mjs`
- Modify: `src/lib/jobs/store.ts`
- Modify: `package.json` (scripts)

**Produces:** `listJobs(opts?)`, `getJob`, `saveJob`, `updateJob`, `migrateLegacyJobs()`, `newJobId` writing under `.data/jobs/<date>/<id>/`.

- [ ] **Step 1:** Add `paths.ts` exporting `DATA_ROOT`, `jobsRoot`, `jobDir(job)`, `outputsDir(job)`, `libraryRoot`, `indexesRoot`.
- [ ] **Step 2:** Rewrite `store.ts` to read/write per-job `job.json`; maintain thin `.data/indexes/jobs.json` for fast list; remove `MAX_JOBS` hard truncate (keep soft warn at 10k in comments only).
- [ ] **Step 3:** Implement `migrateLegacyJobs()` — if `.data/jobs.json` exists and no job folders yet, import each entry, move matching `.data/outputs/<jobId>-*` into the job folder, rewrite output URLs to still use `/api/outputs/<filename>` (filename unchanged).
- [ ] **Step 4:** Add `npm run data:migrate` → `node scripts/migrate-data.mjs`.
- [ ] **Step 5:** Run migrate against current `.data`; assert job folder count ≈ ledger length; commit.

### Task 2: Library index + APIs + gallery sort

**Files:**
- Create: `src/lib/library/kinds.ts`, `src/lib/library/index.ts`
- Create: `src/app/api/library/route.ts`, `src/app/api/library/[...path]/route.ts`
- Modify: `src/app/api/outputs/[name]/route.ts`, adapters that write outputs (write into job `outputs/` when `jobId` known), `src/lib/jobs/runner.ts`
- Modify: `src/app/gallery/page.tsx`

**Produces:** `rebuildLibraryIndex()`, `listLibrary({sort,order,kind,tool,limit,cursor})`, library HTTP routes, gallery sort UI.

- [ ] **Step 1:** On job completion, hard-link each browsable output into `library/<kind>/<yyyy>/<mm>/<jobId>-<file>` and refresh index entries.
- [ ] **Step 2:** `GET /api/library` with sort/filter; `GET /api/library/...` serves file after session (or AUTH_DISABLED).
- [ ] **Step 3:** Outputs route searches job folders then legacy flat dir.
- [ ] **Step 4:** Gallery UI: kind chips + sort select wired to API.
- [ ] **Step 5:** Curl sort endpoints; commit.

### Task 3: Authelia OIDC (Auth.js)

**Files:**
- Create: `src/auth.ts`, `src/app/api/auth/[...nextauth]/route.ts`, `src/middleware.ts`
- Create: `.env.example`
- Modify: `package.json` (add `next-auth`), shell for user/sign-out, `README.md`, health route public

**Produces:** Authelia login redirect, session cookie, middleware gate, README client YAML.

- [ ] **Step 1:** `npm install next-auth@5` (Auth.js).
- [ ] **Step 2:** Authelia provider via generic OIDC; env `AUTH_SECRET`, `AUTH_TRUST_HOST`, `AUTHELIA_ISSUER`, `AUTHELIA_CLIENT_ID`, `AUTHELIA_CLIENT_SECRET`, optional `AUTHELIA_END_SESSION_URL`, `AUTH_DISABLED`.
- [ ] **Step 3:** Middleware: allow `/api/auth/*`, `/api/health` (ensure exists), static icon routes if required; everything else needs auth unless `AUTH_DISABLED`.
- [ ] **Step 4:** Shell shows name/email + Sign out when session present.
- [ ] **Step 5:** With `AUTH_DISABLED=true`, full app still loads; with it false and missing issuer, `next start` logs clear failure path (document). Commit.

### Task 4: Naming/secrets pass + e2e verification

**Files:** any leftover Fieldbench strings; README Authelia section; compose service name `fluxfield` if present.

- [ ] **Step 1:** `rg -i fieldbench` → only design-doc “retired names”.
- [ ] **Step 2:** Secrets/PII scan clean.
- [ ] **Step 3:** E2E: migrate → create dream job → library lists it sorted → job watch survives reload → settings R/W → health 200 without auth when disabled / with auth when enabled (mock).
- [ ] **Step 4:** `npm run build` passes; commit + push.

## Spec coverage checklist

| Spec item | Task |
|---|---|
| Per-job folders | 1 |
| Media library + hard links | 2 |
| Rebuildable JSON index + sort APIs | 2 |
| Legacy migrate | 1 |
| Authelia OIDC Auth.js | 3 |
| BYO Authelia docs | 3 |
| Fluxfield naming | done + 4 |
| Secrets scrub | 4 |
| E2E verify | 4 |
