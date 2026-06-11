# AltCloud Intranet — Operations Runbook

Enterprise intranet and knowledge-base platform for multi-project operational content: contacts, decision matrix, pricing, communications, templates, phrases, links, announcements, forms, and a full knowledge base — plus a global platform shell (project directory, global announcements, audit history).

This repository ships a **production-grade, PostgreSQL-only** stack: a React SPA (`src/`), a stateless Fastify API (`server/`), and a Prisma-managed schema (`prisma/`). The HTTP contract is defined in [`API.md`](./API.md).

---

## Architecture Overview

The platform follows a **three-tier, API-first** design. All business data lives in PostgreSQL. The browser holds module data in **React state (RAM)** after initial REST hydration; there is no `localStorage` business-data path and no bundled JSON runtime.

| Tier | Technology | Responsibility |
|------|------------|----------------|
| **Presentation** | React 19 + Vite + TypeScript | SPA, module providers, in-memory search |
| **Application** | Fastify 5 + TypeScript | REST API `/api/v1/*`, auth resolution, uploads, metrics |
| **Data** | PostgreSQL 16 + Prisma | Operational models (~25 entities), append-only audit trail |

In **production containers**, a single Node process serves both the compiled SPA (`dist/`) and the API. Uploaded media is stored on the filesystem under `runtime-media/` (configurable via `MEDIA_STORAGE_ROOT`).

### Data flow

```
┌──────────────┐     HTTPS (same origin)      ┌─────────────────────────────────────┐
│   Browser    │ ───────────────────────────► │  Fastify (stateless app tier)       │
│  React SPA   │   GET/POST /api/v1/*         │  • Prisma → PostgreSQL              │
│              │   multipart uploads          │  • @fastify/static → dist/ (SPA)    │
│  Module data │ ◄─────────────────────────── │  • @fastify/static → runtime-media/ │
│  in RAM      │   JSON envelopes             └──────────────┬──────────────────────┘
│              │                                              │
│  Ctrl+K      │   searchAll() scans in-memory slices         │  SQL (CRUD + audit)
│  search      │   — no DB full-text queries                  ▼
└──────────────┘                                   ┌─────────────────────┐
                                                   │  PostgreSQL 16      │
                                                   │  (managed / Docker) │
                                                   └─────────────────────┘
```

**Search model:** Global and project search (`src/lib/search/search.ts`) runs entirely **in-memory** over data already loaded into React module providers. This keeps database I/O minimal and avoids server-side search indexes for interactive lookup. Module endpoints return list payloads; the client ranks and filters them locally.

**Audit model:** `AuditLog` rows are an **append-only side effect** of mutations (not the primary datastore). Video tier capacity is derived from audit `create` events for `project_media_upload` entities.

---

## Production-Ready Features

### Security

| Control | Configuration | Behavior |
|---------|---------------|----------|
| **CORS** | `CORS_ALLOWED_ORIGINS` | Comma-separated allowlist. In production, origins not on the list are rejected. Empty value in production logs a warning and blocks cross-origin browser traffic. |
| **Global rate limit** | `RATE_LIMIT_MAX=200`, `RATE_LIMIT_TIME_WINDOW=1 minute` | Applied via `@fastify/rate-limit` to API routes. Operational paths (`/metrics`, `/docs`) are exempt. |
| **Production auth** | Default: header auth **disabled** in `NODE_ENV=production` | Identity is expected from an upstream IdP/gateway in live deployments. See [Pre-IdP Staging Auth](#pre-idp-staging-auth). |
| **Structured logging** | `LOG_LEVEL` | Application logs via Pino to **stdout** only. Business audit events go to PostgreSQL, not log files. |

### Media upload policy & limits

Uploads are handled via `POST /api/v1/uploads` with **per-kind size caps** and **video-only tiered capacity**. The SPA performs client-side pre-validation (localized Polish alerts, limits shown in MB) before any network request; the Fastify backend enforces the same rules authoritatively during `@fastify/multipart` stream parsing and route handling.

#### Per-kind maximum size

| Kind | Limit |
|------|-------|
| **Images (Zdjęcia)** | **5 MB** |
| **Files / documents (Pliki / Dokumenty)** | **10 MB** |
| **Videos (Filmy wideo)** | **300 MB** (`UPLOAD_MAX_FILE_SIZE_BYTES=314572800` also caps multipart streams globally) |

#### Video tiered capacity (per project)

Tier counting applies **only to video** uploads and is derived from `project_media_upload` audit `create` events:

| Tier | Size range | Max videos per project |
|------|------------|------------------------|
| **Small** | ≤ 25 MB | **10** |
| **Large** | \> 25 MB and ≤ 300 MB | **3** |

Images and documents are not subject to tier quotas—only their per-kind size limits above.

#### Other upload controls

| Rule | Limit | Enforcement |
|------|-------|-------------|
| **Upload rate limit** | **5 requests / minute / IP** | Route-level limit on `POST /api/v1/uploads` (`UPLOAD_RATE_LIMIT_MAX`, `UPLOAD_RATE_LIMIT_TIME_WINDOW`) |

Violations return **HTTP 400** with codes such as `UPLOAD_TOO_LARGE` or `UPLOAD_CAPACITY_EXCEEDED`. Accepted files are stored under `MEDIA_STORAGE_ROOT` (default `runtime-media/`) and served at `/photos/*`, `/videos/*`, `/files/*`.

### Telemetry and API documentation

| Endpoint | Purpose | Access |
|----------|---------|--------|
| **`GET /metrics`** | Prometheus text exposition (`prom-client`: process + HTTP metrics) | Unauthenticated; scrape from your observability stack |
| **`GET /docs`** | Swagger UI (`@fastify/swagger-ui`) | **Disabled in production** unless `ENABLE_SWAGGER=true` |
| **`GET /openapi.json`** | OpenAPI 3 specification | Always registered (hidden from Swagger tag list) |

Swagger UI is enabled when `NODE_ENV !== 'production'` **or** `ENABLE_SWAGGER=true`.

---

## Database Lifecycle and Retention

### Schema authority

`prisma/schema.prisma` is the **sole source of truth** for the database. Apply changes with Prisma migrations only.

### AuditLog and JSONB

The `AuditLog` model stores flexible event context in native PostgreSQL **JSONB** (`metadata_jsonb`):

- `occurredAt` — business timestamp used for retention (not `createdAt`)
- `actorUserId`, `projectId`, `moduleKey`, `entityType`, `entityId`, `actionType`
- `metadataJson` — structured payload (e.g. upload `sizeBytes`, `storedPath`)

Indexes support time-range and project-scoped audit queries.

### Automated 90-day retention

A background scheduler (`server/src/jobs/audit-retention-scheduler.ts`) runs:

1. **On server startup** (after `listen`)
2. **Every 7 days**

It deletes rows where `occurredAt` is older than **90 days** (`AUDIT_LOG_RETENTION_DAYS` in `server/src/lib/audit-retention.ts`). Prune results are logged with `deletedCount` and cutoff timestamp.

---

## Getting Started

### Prerequisites

- **Docker** and **Docker Compose** (recommended for production-like runs)
- **Node.js** `^20` or `^22` (local development; see `.nvmrc`)

### Docker Compose (recommended)

The root `Dockerfile` builds a multi-stage image: Vite frontend → TypeScript server → runtime with Prisma client generation. `docker-compose.yml` orchestrates PostgreSQL and the app.

```bash
# Build and start PostgreSQL + application
docker compose up --build
```

| Service | Image / build | Port | Notes |
|---------|---------------|------|-------|
| `db` | `postgres:16-alpine` | internal | Persistent volume `postgres_data` |
| `app` | Root `Dockerfile` | **3001** | SPA + API; volume `app_media` → `/app/runtime-media` |

**Startup sequence** (`docker/entrypoint.sh`):

1. `prisma migrate deploy` — applies pending migrations automatically
2. Database seed when `RUN_DB_SEED=auto` and no users exist (or always when `RUN_DB_SEED=true`)
3. `node server/dist/index.js`

Open **http://localhost:3001** after containers are healthy.

To reset all data (including Postgres and uploaded media):

```bash
docker compose down -v
docker compose up --build
```

### Local development (without Docker)

```bash
npm ci
cp .env.example .env          # set DATABASE_URL, CORS, optional dev user email
npm run prisma:generate
npm run prisma:migrate:deploy
npm run prisma:seed           # optional baseline data

# Terminal 1 — API on :3001
npm run dev:server

# Terminal 2 — Vite dev server on :5173 (proxies /api to backend)
npm run dev
```

Set `VITE_ALTCLOUD_API_DEV_USER_EMAIL` to a seeded user (e.g. `super.admin@intranet.local`) so the SPA sends `x-dev-user-email` on API calls.

### Validation

```bash
npm run lint
npm run typecheck:server
npm run build
npm run build:server
npm run prisma:validate
npm run test:server
```

---

## Pre-IdP Staging Auth

Before the corporate Identity Provider is integrated, use **Preview Authentication** to test roles inside a production-mode container.

| Variable | Purpose |
|----------|---------|
| `ENABLE_PREVIEW_AUTH=true` | Allows `x-dev-user-email` header resolution even when `NODE_ENV=production` |
| `PREVIEW_AUTH_DEFAULT_USER_EMAIL` | Fallback user when the browser sends no header |
| `VITE_ALTCLOUD_API_DEV_USER_EMAIL` | Baked into the SPA at **Docker build time** (build arg); also read at runtime by the server fallback chain |

When preview auth is active, the server logs:

```
[SECURITY WARNING] Preview Authentication is ENABLED. Do not use this configuration in a live production environment!
```

**Identity resolution order (preview mode, no header):**

1. `VITE_ALTCLOUD_API_DEV_USER_EMAIL` (container env)
2. `PREVIEW_AUTH_DEFAULT_USER_EMAIL`
3. First active `super_admin` in the database
4. `super.admin@intranet.local`

The SPA shows a **preview auth bar** when bootstrap `authMode` is `preview_header`, with a dropdown to switch test users (persisted in `sessionStorage`). API: `GET /api/v1/platform/preview-auth/users` (only when preview auth is enabled).

**Example `docker-compose.yml` fragment:**

```yaml
environment:
  ENABLE_PREVIEW_AUTH: "true"
  PREVIEW_AUTH_DEFAULT_USER_EMAIL: super.admin@intranet.local
  RUN_DB_SEED: auto
build:
  args:
    VITE_ALTCLOUD_API_DEV_USER_EMAIL: super.admin@intranet.local
```

> **Live production:** Set `ENABLE_PREVIEW_AUTH=false` (default). Strip `x-dev-user-email` at the gateway and inject identity from your IdP. Do not expose preview auth on public networks.

---

## SRE Operational Notes

### High availability (HA) deployments

The application tier is **stateless** — scale horizontally by running multiple `app` replicas behind a load balancer. Two components require shared infrastructure:

| Component | Single-instance default | HA requirement |
|-----------|----------------------|----------------|
| **PostgreSQL** | Docker volume `postgres_data` | Use a **managed, shared PostgreSQL** service (RDS, Cloud SQL, Azure Database, etc.). Do not rely on per-pod ephemeral databases. |
| **Uploaded media** | `runtime-media/` on local disk | Mount `MEDIA_STORAGE_ROOT` to a **shared network filesystem** (AWS EFS, NFS, GlusterFS, Azure Files) so every replica serves the same files. In Compose, volume `app_media` must be backed by shared storage in multi-instance clusters. |

### Environment reference

| Variable | Default | Description |
|----------|---------|-------------|
| `NODE_ENV` | `development` | `production` in containers |
| `SERVER_HOST` / `SERVER_PORT` | `127.0.0.1` / `3001` | Bind address |
| `DATABASE_URL` | — | **Required.** PostgreSQL connection string |
| `CORS_ALLOWED_ORIGINS` | — | Comma-separated browser origins |
| `RATE_LIMIT_MAX` | `200` | Global API rate limit |
| `RATE_LIMIT_TIME_WINDOW` | `1 minute` | Global rate-limit window |
| `UPLOAD_MAX_FILE_SIZE_BYTES` | `314572800` | 300 MB multipart cap |
| `UPLOAD_RATE_LIMIT_MAX` | `5` | Upload endpoint rate limit |
| `UPLOAD_RATE_LIMIT_TIME_WINDOW` | `1 minute` | Upload rate-limit window |
| `ENABLE_SWAGGER` | `false` | Expose `/docs` in production when `true` |
| `ENABLE_PREVIEW_AUTH` | `false` | Pre-IdP header auth in production |
| `PREVIEW_AUTH_DEFAULT_USER_EMAIL` | — | Preview fallback identity |
| `STATIC_WEB_ROOT` | — | SPA root (`/app/dist` in Docker) |
| `MEDIA_STORAGE_ROOT` | `./runtime-media` | Upload filesystem root |
| `RUN_DB_SEED` | `auto` | `auto` \| `true` \| `false` — seed control in Docker |
| `LOG_LEVEL` | `info` | Pino log level |

See [`.env.example`](./.env.example) for the full template.

### Health and operations endpoints

| Path | Description |
|------|-------------|
| `GET /api/v1/health/live` | Liveness |
| `GET /api/v1/meta` | Service metadata |
| `GET /metrics` | Prometheus scrape target |

### Repository layout

| Path | Contents |
|------|----------|
| `src/` | React SPA, module providers, in-memory search |
| `server/src/` | Fastify app, routes, plugins, jobs |
| `prisma/` | Schema, migrations, seed |
| `docker/` | Entrypoint, seed gate script |
| `Dockerfile` | Multi-stage production image |
| `docker-compose.yml` | Local/staging orchestration |
| `API.md` | HTTP API reference |

---

## API Contract

All REST shapes, envelopes, error codes, roles, and upload semantics are specified in **[`API.md`](./API.md)**. External backends or gateway integrations must conform to that contract.

---

## License

Private / internal use — see repository ownership and organizational policy.
