# AltCloud Intranet

A multi-project **intranet and knowledge base platform** built on React 19 + Vite (frontend) and Fastify + Prisma + PostgreSQL (backend). It serves project-scoped operational modules — contacts, decision matrix, pricing tables, communications, document templates, phrase libraries, links, quick links, announcements, and a full knowledge base — alongside a global platform shell with project directory, global announcements, and audit history.

The repository contains both the SPA (`src/`) and the **application server** (`server/`). The server is the production implementation of the API contract defined in **[`API.md`](./API.md)**; any replacement or supplementary backend service must conform to those contracts.

---

## Runtime Architecture

### Two execution modes

The entire data plane is controlled by a single `.env` variable:

| Variable | Value | Effect |
|---|---|---|
| `VITE_ALTCLOUD_PLATFORM_DATA_SOURCE` | `legacy-json` | **Default.** Data is read from a bundled `AppData` JSON document stored in `localStorage` (`altcloud_data`). No backend required. Ideal for demos and UI iteration. |
| `VITE_ALTCLOUD_PLATFORM_DATA_SOURCE` | `api` | **API-first mode.** Each module provider fetches from its own REST endpoint under `/api/v1`. The Fastify server must be running and `DATABASE_URL` must point to a live PostgreSQL instance. |

Switch by editing `.env` before starting the Vite dev server. `VITE_*` variables are embedded in the client bundle at build time — they are **not secrets**.

### Strangler Pattern fallback — why JSON structures exist in frontend code

The migration from the legacy JSON runtime to the REST API follows the [Strangler Fig Pattern](https://martinfowler.com/bliki/StranglerFigApplication.html). Every module provider resolves its read model as:

```
resolvedData = apiData ?? legacySlice
```

When `api` mode is active and a module fetch is still in flight (or has not yet returned), the provider transparently falls back to the slice of data that was loaded from the bundled JSON / `localStorage`. This means:

- **You will see `AppData` JSON structures in the frontend codebase.** They are the fallback, not a parallel source of truth.
- Once a module's API fetch resolves successfully, `apiData` takes precedence and the legacy slice becomes irrelevant for that session.
- The bundled JSON will be removed once all module providers are confirmed stable in `api` mode.

**Do not add new product behavior to the bundled JSON or `localStorage` paths.** All new business logic belongs in the backend service layer.

---

## Local Setup & Installation

### Prerequisites

- **Node.js** `^20` or `^22` — use [nvm](https://github.com/nvm-sh/nvm) with the included `.nvmrc`
- **PostgreSQL** — a local instance on port `5432` is assumed by `.env.example`

### 1. Install dependencies

```bash
npm ci
```

### 2. Configure environment

Copy the example and fill in values:

```bash
cp .env.example .env
```

Key variables to review:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string (required in `api` mode) |
| `VITE_ALTCLOUD_PLATFORM_DATA_SOURCE` | `legacy-json` (no backend needed) or `api` |
| `VITE_ALTCLOUD_API_BASE_URL` | Backend origin; defaults to `http://127.0.0.1:3001` |
| `VITE_ALTCLOUD_API_DEV_USER_EMAIL` | Gateway identity header value — corporate email of the user to resolve; see **Authentication** below |

### 3. Prepare Prisma

```bash
npm run prisma:generate          # generates the Prisma client
npm run prisma:migrate:deploy    # applies all pending migrations
npm run prisma:seed              # optional — loads bootstrap data for local use
```

### 4. Start the backend (api mode only)

```bash
nvm use 22 && npm run dev:server
```

The server starts on `http://127.0.0.1:3001`. Vite proxies all `/api`, `/photos`, `/videos`, and `/files` requests to this origin automatically.

### 5. Start the frontend

```bash
npm run dev
```

The SPA is served at `http://localhost:5173` (or next available port).

### Validation commands

Run these before opening a pull request:

```bash
npm run lint               # ESLint flat config (eslint.config.js)
npm run typecheck:server   # TypeScript check for server/
npm run build              # full production build
npm run prisma:validate    # schema integrity check
npm run test:server        # server integration tests
```

CI runs all of the above automatically on every pull request via `.github/workflows/ci.yml`.

---

## Authentication

### Gateway-Offloaded Authentication Protocol

The platform uses a **gateway-offloaded identity model**. An upstream API Gateway or Reverse Proxy — such as nginx, AWS API Gateway, Traefik, or a corporate SSO edge service — is solely responsible for authenticating inbound requests, managing session tokens, and validating SSO / OIDC / SAML 2.0 assertions. Once the gateway has verified a caller's identity, it injects the resolved corporate email into the application layer via a trusted HTTP header:

```
x-dev-user-email: alice.smith@example.com
```

Set `VITE_ALTCLOUD_API_DEV_USER_EMAIL` in `.env` to the email of a provisioned user. The frontend attaches this header to every API request; the application server trusts it as the authoritative identity signal, looks up the matching `User` row, and derives all role and capability decisions from that record.

This architecture deliberately decouples identity management from the application service, allowing the platform to integrate with any enterprise identity provider at the gateway layer without changes to application code.

> **Network security boundary:** The `x-dev-user-email` header must be stripped from all inbound public requests by the upstream gateway before forwarding to the application service. Application service ports must be accessible only from the internal network or via dedicated gateway ingress. See [`API.md`](./API.md) → **Authentication & Headers** for the full protocol specification.

---

## Project Structure (key paths)

| Path | Contents |
|---|---|
| `src/contexts/modules/` | Per-module React providers (contacts, phrases, matrix, …) |
| `src/lib/api/` | HTTP client functions for each API resource |
| `src/lib/types/domain.ts` | Canonical domain types shared across frontend |
| `server/src/routes/` | Fastify route handlers — production API implementation |
| `prisma/schema.prisma` | **Sole source of truth for the database schema** |
| `server/test/api-hardening.test.ts` | Server integration test suite |

---

## API Contract

> **See [`API.md`](./API.md) for the complete HTTP API reference** — all request/response shapes, envelope format, error codes, role definitions, and the Client-Side Search Architecture specification.
