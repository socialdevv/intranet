# Intranet — API Reference

| | |
|---|---|
| **API prefix** | `/api/v1` |
| **Mode required** | `VITE_ALTCLOUD_PLATFORM_DATA_SOURCE=api` |
| **Dev auth header** | `x-dev-user-email: <email>` |
| **Source of truth** | `src/lib/api/*.ts`, `server/src/routes/*.ts` |

All paths below are **relative to `/api/v1`** unless stated otherwise.

---

## Table of Contents

1. [Global Response Envelope](#1-global-response-envelope)
2. [Authentication & Headers](#2-authentication--headers)
3. [Health & Meta](#3-health--meta)
4. [Platform Bootstrap](#4-platform-bootstrap)
5. [Platform Announcements](#5-platform-announcements)
6. [Platform Links (Global Quick Links)](#6-platform-links-global-quick-links)
7. [Project Bootstrap & Configuration](#7-project-bootstrap--configuration)
8. [Contacts](#8-contacts)
9. [Phrases (Ready-made Responses)](#9-phrases-ready-made-responses)
10. [Links](#10-links)
11. [Quick Links](#11-quick-links)
12. [Announcements](#12-announcements)
13. [Matrix (Decision Board)](#13-matrix-decision-board)
14. [Knowledge Base — Categories](#14-knowledge-base--categories)
15. [Knowledge Base — Articles](#15-knowledge-base--articles)
16. [Communications](#16-communications)
17. [Templates](#17-templates)
18. [Pricing Tables](#18-pricing-tables)
19. [Important Topics](#19-important-topics)
20. [Forms](#20-forms)
21. [Audit History](#21-audit-history)
22. [File Upload](#22-file-upload)
23. [Error Code Reference](#23-error-code-reference)
24. [Client-Side Search Architecture](#24-client-side-search-architecture)

---

## 1. Global Response Envelope

### Success

All endpoints (except file upload — see §22) return:

```json
{
  "data": { },
  "meta": {
    "requestId": "abc-123",
    "timestamp": "2026-06-09T11:00:00.000Z"
  }
}
```

**List response** — `data` contains:

```json
{
  "project": { "id": "uuid", "slug": "altcloud", "code": "ALT", "name": "Display Name" },
  "items": [ ]
}
```

**Single-item mutation response** — `data` contains:

```json
{
  "project": { "id": "uuid", "slug": "altcloud", "code": "ALT", "name": "Display Name" },
  "item": { }
}
```

**Delete response** — `data` contains:

```json
{
  "project": { "id": "uuid", "slug": "altcloud", "code": "ALT", "name": "Display Name" },
  "deletedId": "uuid"
}
```

Platform-scoped resources (§5, §6) omit `project` and use `{ "items": [] }` / `{ "item": {} }` / `{ "deletedId": "" }` directly.

### Error

HTTP `4xx`/`5xx`. Body:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human-readable description",
    "details": {},
    "fieldErrors": [
      { "field": "title", "code": "too_small", "message": "Title is required." }
    ],
    "retryable": false
  },
  "meta": {
    "requestId": "abc-123",
    "timestamp": "2026-06-09T11:00:00.000Z"
  }
}
```

### HTTP method conventions

| Operation | Method | Notes |
|---|---|---|
| Read collection | `GET` | `cache: no-store` on client |
| Create | `POST` | `Content-Type: application/json` |
| Partial update | `PATCH` | Changed fields only |
| Full replace (config) | `PUT` | Navigation, spotlights, lead config |
| Delete | `DELETE` | Empty body |
| Reorder | `POST` | Appended to `.../reorder` sub-path |

---

## 2. Authentication & Headers

### Gateway-Offloaded Authentication Protocol

The platform implements a **gateway-offloaded identity model**. An upstream corporate API Gateway or Reverse Proxy is solely responsible for all authentication concerns: SSO federation, OIDC/SAML 2.0 token validation, session lifecycle, and MFA enforcement. Once the gateway has verified a caller's identity, it injects the resolved corporate user identity into the application layer via a trusted HTTP header before forwarding the request downstream:

| Header | Injected by | Value |
|---|---|---|
| `x-dev-user-email` | Upstream API Gateway / Reverse Proxy | Corporate email of the authenticated user |
| `Content-Type` | Client | `application/json` on mutation requests |

The application server treats this header as the authoritative identity signal. It looks up the matching `User` row in the database and derives all role and capability decisions from that record. No authentication logic runs inside the application service itself — that responsibility belongs entirely to the upstream gateway.

This design deliberately decouples identity management from the application layer. Any enterprise SSO provider (Okta, Azure AD, Keycloak, PingFederate, etc.) can be integrated or swapped at the gateway tier without any changes to application code or database schema.

> **Network security boundary:** The `x-dev-user-email` header **must** be stripped from all inbound public-internet requests by the upstream gateway before traffic reaches the application service. Application service ports must be accessible only from the internal network or via dedicated gateway ingress. Failure to enforce this boundary would allow identity spoofing.

---

## 3. Health & Meta

### `GET /health/live`

Liveness probe — no auth required.

```json
{ "data": { "status": "ok" }, "meta": { ... } }
```

### `GET /health/ready`

Readiness probe — verifies database connectivity.

```json
{
  "data": { "status": "ok", "dependencies": { "database": "up" } },
  "meta": { ... }
}
```

Returns HTTP `503` with `error.code: "SERVICE_UNREADY"` when the database is unreachable.

### `GET /meta`

```json
{
  "data": {
    "service": {
      "name": "altcloud-api",
      "version": "0.1.0",
      "environment": "development",
      "apiVersion": "v1"
    }
  }
}
```

---

## 4. Platform Bootstrap

### `GET /platform/bootstrap`

The single call the SPA makes on startup in `api` mode. Returns session context, the full user profile, platform-level capabilities, the project directory with per-project access and module matrices, and global content. The frontend will not render the application shell until this call resolves.

---

### 4.1 `session` object

| Field | Type | Description |
|---|---|---|
| `isAuthenticated` | boolean | Always `true` when the server returns HTTP 200. |
| `sessionId` | string \| null | Opaque session identifier. `null` when identity is resolved from a stateless gateway-injected header. |
| `authMode` | `"gateway-header"` \| `"session"` \| `"bearer"` | Identifies how the user was resolved. `"gateway-header"` is the standard mode when the upstream gateway injects the identity header. |
| `expiresAt` | ISO-8601 \| null | Session expiry time. `null` when identity is resolved from a stateless gateway header. |
| `impersonation.active` | boolean | `true` when a `super_admin` is acting as another user. |
| `currentUserResolver.type` | string | Resolution strategy used for this request (e.g. `"gateway-header"`). |
| `currentUserResolver.headerName` | string \| null | Name of the trusted header used to resolve identity. Present when `authMode` is `"gateway-header"`. |
| `currentUserResolver.fallbackEmail` | string \| null | Configured fallback identity used when the gateway header is absent (service-to-service or health-check contexts). |

---

### 4.2 `user` object — full profile

| Field | Type | Notes |
|---|---|---|
| `id` | string (UUID) | Stable database identifier. |
| `email` | string | Primary login email. |
| `firstName` | string | Given name. Used for display and audit attribution. |
| `lastName` | string | Family name. Used for display and audit attribution. |
| `displayName` | string | Canonical display string — typically `"firstName lastName"` or a user-configured override. |
| `initials` | string | 1–2 uppercase characters derived from `firstName`/`lastName`. Used in avatar fallback UI. |
| `avatarUrl` | string \| null | Absolute URL to the user's profile image. `null` when no avatar is set — UI should render `initials` fallback. |
| `globalRole` | `GlobalRole` enum | Platform-wide role. See §4.3 for the full role matrix. |
| `status` | `"active"` \| `"suspended"` \| `"pending"` | `"suspended"` users should be treated as unauthenticated by the frontend. |

---

### 4.3 Global Role matrix

The `globalRole` field drives all platform-level capability decisions. Project-level access is an **additional** layer on top (see §4.6).

| Role value | Display name | Business scope |
|---|---|---|
| `super_admin` | Super Administrator | Full infrastructure and platform configuration access. Can create, configure, and permanently delete projects; manage all user accounts and global role assignments; impersonate any user for support and debugging; access the complete audit log across all projects and all time; override any module lock or access restriction. Has implicit `project_admin` semantics on every project regardless of explicit membership. |
| `platform_manager` | Platform Manager | Platform-level content and structure authority. Can provision new projects and archive existing ones; manage platform-wide announcements, global quick links, and global upload policies; read content across all projects for oversight purposes. Cannot manage individual user account credentials or global role assignments, and cannot mutate project-scoped module content without a project membership. |
| `regular_user` | Regular User | Read-only platform shell access. Can view the project directory, read global announcements and quick links, and navigate to any project they hold a membership on. All write capabilities within a project are determined exclusively by the `effectiveProjectRole` on each individual project membership (see §4.6). Default role for all newly provisioned employees. |

> **Backend rule:** If a new employee is provisioned without an explicit global role, default to `"regular_user"`. Never default to `"super_admin"` or `"platform_manager"` unless explicitly authorised by a `super_admin`.

---

### 4.4 `capabilities.platform` object

Derived server-side from `globalRole`. The frontend uses these flags for platform shell gating — **do not recompute them on the client**.

| Field | Type | Granted to |
|---|---|---|
| `canAccessIntranet` | boolean | All active users |
| `canViewProjectDirectory` | boolean | All active users |
| `canUseGlobalSearch` | boolean | All active users — powered by Client-Side In-Memory Indexing (see §24) |
| `canViewGlobalAnnouncements` | boolean | All active users |
| `canViewGlobalQuickLinks` | boolean | All active users |
| `canManagePlatformContent` | boolean | `super_admin`, `platform_manager` |
| `canCreateProjects` | boolean | `super_admin`, `platform_manager` |
| `canManageGlobalUsers` | boolean | `super_admin` only |
| `canUseImpersonation` | boolean | `super_admin` only |
| `canViewPlatformAudit` | boolean | `super_admin` only |

---

### 4.5 `homepage` object

| Field | Type | Description |
|---|---|---|
| `welcomeTitle` | string | Title rendered on the platform home screen. |
| `globalAnnouncements` | `PlatformAnnouncementRecord[]` | Active, currently-visible platform-wide announcements (filtered by `active`, `visibleFrom`, `visibleUntil` server-side). See §5 for the record shape. |
| `globalQuickLinks` | `PlatformLinkRecord[]` | Ordered global quick links. See §6 for the record shape. |

---

### 4.6 `projects` array — per-project access and module matrix

Each entry in `projects` represents a project the current user can see. Projects with `access.isVisible: false` are omitted entirely from the array for `user`-role accounts. `super_admin` accounts always receive the full directory.

#### Project directory entry fields

| Field | Type | Description |
|---|---|---|
| `id` | string (UUID) | Stable project identifier. |
| `slug` | string | URL-safe identifier used in all API paths. |
| `code` | string | Short uppercase code (e.g. `"ALT"`). Used in audit labels. |
| `name` | string | Human-readable project display name. |
| `description` | string \| null | Optional longer description shown in the project directory. |
| `sortOrder` | number | Display order in the project directory. Lower values appear first. |

#### `membership` object — direct role assignment

Present when the user has an explicit database membership record for this project. `super_admin` users receive a synthesised membership object with `roleSource: "super_admin_override"`.

| Field | Type | Description |
|---|---|---|
| `role` | `ProjectRole` enum | The role explicitly assigned to this user. See the role table below. |
| `roleSource` | `"membership"` \| `"super_admin_override"` | `"super_admin_override"` means no membership row exists; access is granted by global role. |
| `assignedAt` | ISO-8601 \| null | When the membership was created. `null` for `super_admin_override`. |
| `assignedBy` | string (UUID) \| null | User ID of the admin who created the membership. `null` for `super_admin_override`. |
| `groups` | string[] | Organisational group tags applied to this membership (e.g. `["Warsaw", "Customer-Ops"]`). Used for directory filtering; does not affect permissions. |

#### Project Role values

| Role value | Display name | What this role can do within the project |
|---|---|---|
| `project_admin` | Project Administrator | Full project authority: create, edit, and delete all module content; manage module on/off configuration and navigation order; manage project member roles; view the full project audit history; upload files. Implicitly granted to all `super_admin` accounts. |
| `editor` | Editor | Full content authority across all enabled modules: create, edit, and delete records. Cannot manage module configuration, cannot manage memberships, and cannot view audit history. |
| `viewer` | Viewer | Read-only access to all enabled module content. Cannot create, edit, or delete any records. Cannot upload files. Default role when a user is granted access to a sensitive or restricted project. |

#### `access` object — effective access state

| Field | Type | Description |
|---|---|---|
| `isVisible` | boolean | Whether this project appears in the directory for this user. |
| `isLocked` | boolean | `true` when the project is locked to `project_admin` and `super_admin` only. |
| `effectiveProjectRole` | `ProjectRole` \| null | The role actually enforced for this request — the higher of `membership.role` and any platform-level override. `null` for users with no access. |
| `lockReason` | string \| null | Machine-readable reason code when `isLocked` is `true`. |
| `lockMessage` | string \| null | Human-readable message to display to users who are locked out. |
| `allowedModules` | string[] | Array of backend module keys the user may access based on their effective role and which modules are enabled (e.g. `["contacts", "phrases", "matrix", "announcements"]`). Computed server-side. |

#### `capabilities.project` object — project-level boolean flags

| Field | Type | Granted to |
|---|---|---|
| `canEnterProject` | boolean | Any user with `effectiveProjectRole` set and `isLocked: false` |
| `canViewProjectHome` | boolean | `viewer`, `editor`, `project_admin` |
| `canSearchProject` | boolean | All project members — powered by Client-Side In-Memory Indexing (see §24) |
| `canEditContent` | boolean | `editor`, `project_admin` |
| `canManageCategories` | boolean | `project_admin` |
| `canManageModules` | boolean | `project_admin` |
| `canManageMemberships` | boolean | `project_admin` |
| `canUploadFiles` | boolean | `editor`, `project_admin` |
| `canViewAudit` | boolean | `project_admin` |

#### `capabilities.modules` object — per-module capability flags

Each key is a backend module key (see §7 for the full key mapping). Only **enabled** modules appear in this object.

| Field | Type | Description |
|---|---|---|
| `enabled` | boolean | Whether this module is active for the project. |
| `canView` | boolean | User may read records from this module. |
| `canCreate` | boolean | User may create new records. |
| `canEdit` | boolean | User may update existing records. |
| `canDelete` | boolean | User may delete records. |
| `canReorder` | boolean | User may call the `reorder` endpoint. Present only on modules that support reordering. |

---

### 4.7 Full response example

```json
{
  "data": {
    "session": {
      "isAuthenticated": true,
      "sessionId": null,
      "authMode": "gateway-header",
      "expiresAt": null,
      "impersonation": { "active": false },
      "currentUserResolver": {
        "type": "gateway-header",
        "headerName": "x-dev-user-email",
        "fallbackEmail": "admin@example.com"
      }
    },
    "user": {
      "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "email": "jan.kowalski@example.com",
      "firstName": "Jan",
      "lastName": "Kowalski",
      "displayName": "Jan Kowalski",
      "initials": "JK",
      "avatarUrl": "https://host/photos/avatars/jan-kowalski.jpg",
      "globalRole": "super_admin",
      "status": "active"
    },
    "capabilities": {
      "platform": {
        "canAccessIntranet": true,
        "canViewProjectDirectory": true,
        "canUseGlobalSearch": true,
        "canViewGlobalAnnouncements": true,
        "canViewGlobalQuickLinks": true,
        "canManagePlatformContent": true,
        "canCreateProjects": true,
        "canManageGlobalUsers": true,
        "canUseImpersonation": true,
        "canViewPlatformAudit": true
      }
    },
    "homepage": {
      "welcomeTitle": "Intranet",
      "globalAnnouncements": [
        {
          "id": "ann-uuid-1",
          "title": "System maintenance window",
          "description": "Planned downtime Saturday 21:00–23:00.",
          "color": "orange",
          "active": true,
          "visibleFrom": "2026-06-14T19:00:00.000Z",
          "visibleUntil": "2026-06-14T23:00:00.000Z",
          "createdAt": "2026-06-09T10:00:00.000Z",
          "updatedAt": "2026-06-09T10:00:00.000Z"
        }
      ],
      "globalQuickLinks": []
    },
    "projects": [
      {
        "id": "proj-uuid-1",
        "slug": "altcloud",
        "code": "ALT",
        "name": "AltCloud Operations",
        "description": "Main operational project for the AltCloud team.",
        "sortOrder": 0,
        "membership": {
          "role": "project_admin",
          "roleSource": "super_admin_override",
          "assignedAt": null,
          "assignedBy": null,
          "groups": []
        },
        "access": {
          "isVisible": true,
          "isLocked": false,
          "effectiveProjectRole": "project_admin",
          "lockReason": null,
          "lockMessage": null,
          "allowedModules": [
            "contacts",
            "phrases",
            "links",
            "quick_links",
            "announcements",
            "matrix",
            "communications",
            "templates",
            "pricing",
            "important_topics",
            "forms"
          ]
        },
        "capabilities": {
          "project": {
            "canEnterProject": true,
            "canViewProjectHome": true,
            "canSearchProject": true,
            "canEditContent": true,
            "canManageCategories": true,
            "canManageModules": true,
            "canManageMemberships": true,
            "canUploadFiles": true,
            "canViewAudit": true
          },
          "modules": {
            "contacts": {
              "enabled": true,
              "canView": true,
              "canCreate": true,
              "canEdit": true,
              "canDelete": true,
              "canReorder": true
            },
            "phrases": {
              "enabled": true,
              "canView": true,
              "canCreate": true,
              "canEdit": true,
              "canDelete": true,
              "canReorder": true
            },
            "matrix": {
              "enabled": true,
              "canView": true,
              "canCreate": true,
              "canEdit": true,
              "canDelete": true,
              "canReorder": true
            },
            "announcements": {
              "enabled": true,
              "canView": true,
              "canCreate": true,
              "canEdit": true,
              "canDelete": true
            },
            "links": {
              "enabled": true,
              "canView": true,
              "canCreate": true,
              "canEdit": true,
              "canDelete": true,
              "canReorder": true
            },
            "communications": {
              "enabled": true,
              "canView": true,
              "canCreate": true,
              "canEdit": true,
              "canDelete": true
            },
            "templates": {
              "enabled": true,
              "canView": true,
              "canCreate": true,
              "canEdit": true,
              "canDelete": true,
              "canReorder": true
            },
            "pricing": {
              "enabled": true,
              "canView": true,
              "canCreate": true,
              "canEdit": true,
              "canDelete": true
            },
            "important_topics": {
              "enabled": false,
              "canView": false,
              "canCreate": false,
              "canEdit": false,
              "canDelete": false
            },
            "forms": {
              "enabled": true,
              "canView": true,
              "canCreate": true,
              "canEdit": true,
              "canDelete": true
            }
          }
        }
      },
      {
        "id": "proj-uuid-2",
        "slug": "logistics",
        "code": "LOG",
        "name": "Logistics Hub",
        "description": "Shipping, returns, and carrier management.",
        "sortOrder": 1,
        "membership": {
          "role": "editor",
          "roleSource": "membership",
          "assignedAt": "2026-01-15T09:00:00.000Z",
          "assignedBy": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
          "groups": ["Warsaw", "Customer-Ops"]
        },
        "access": {
          "isVisible": true,
          "isLocked": false,
          "effectiveProjectRole": "editor",
          "lockReason": null,
          "lockMessage": null,
          "allowedModules": ["contacts", "phrases", "announcements", "matrix"]
        },
        "capabilities": {
          "project": {
            "canEnterProject": true,
            "canViewProjectHome": true,
            "canSearchProject": true,
            "canEditContent": true,
            "canManageCategories": false,
            "canManageModules": false,
            "canManageMemberships": false,
            "canUploadFiles": true,
            "canViewAudit": false
          },
          "modules": {
            "contacts": {
              "enabled": true,
              "canView": true,
              "canCreate": true,
              "canEdit": true,
              "canDelete": true,
              "canReorder": true
            },
            "phrases": {
              "enabled": true,
              "canView": true,
              "canCreate": true,
              "canEdit": true,
              "canDelete": true,
              "canReorder": true
            },
            "announcements": {
              "enabled": true,
              "canView": true,
              "canCreate": true,
              "canEdit": true,
              "canDelete": true
            },
            "matrix": {
              "enabled": true,
              "canView": true,
              "canCreate": false,
              "canEdit": false,
              "canDelete": false,
              "canReorder": false
            }
          }
        }
      },
      {
        "id": "proj-uuid-3",
        "slug": "finance",
        "code": "FIN",
        "name": "Finance & Compliance",
        "description": null,
        "sortOrder": 2,
        "membership": {
          "role": "viewer",
          "roleSource": "membership",
          "assignedAt": "2026-03-01T08:30:00.000Z",
          "assignedBy": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
          "groups": ["Finance-Read"]
        },
        "access": {
          "isVisible": true,
          "isLocked": true,
          "effectiveProjectRole": "viewer",
          "lockReason": "restricted_access",
          "lockMessage": "This project requires Finance team clearance. Contact your manager.",
          "allowedModules": ["communications", "important_topics"]
        },
        "capabilities": {
          "project": {
            "canEnterProject": false,
            "canViewProjectHome": false,
            "canSearchProject": false,
            "canEditContent": false,
            "canManageCategories": false,
            "canManageModules": false,
            "canManageMemberships": false,
            "canUploadFiles": false,
            "canViewAudit": false
          },
          "modules": {
            "communications": {
              "enabled": true,
              "canView": false,
              "canCreate": false,
              "canEdit": false,
              "canDelete": false
            },
            "important_topics": {
              "enabled": true,
              "canView": false,
              "canCreate": false,
              "canEdit": false,
              "canDelete": false
            }
          }
        }
      }
    ],
    "uploads": {
      "defaults": {
        "image": { "maxBytes": 5242880, "allowedMimePatterns": ["image/*"] },
        "file": { "maxBytes": 10485760, "allowedMimePatterns": ["application/*", "text/*"] },
        "video": { "maxBytes": 524288000, "allowedMimePatterns": ["video/*"] }
      }
    },
    "search": {
      "globalSearchEnabled": true,
      "minQueryLength": 2
    }
  },
  "meta": {
    "requestId": "req-abc-123",
    "timestamp": "2026-06-09T11:00:00.000Z"
  }
}
```

> **Note on `search`:** The `search` block is a capability hint for the platform shell UI. Search is intentionally implemented as a **Client-Side In-Memory Indexing Strategy** — an architectural decision that delivers sub-millisecond query results with zero database overhead. See [§24](#24-client-side-search-architecture) for the full architecture specification.

---

## 5. Platform Announcements

**Base path:** `/platform/announcements`

### Record shape

| Field | Type | Required |
|---|---|---|
| `id` | string (UUID) | — |
| `title` | string | yes |
| `body` | TipTap JSON object | no |
| `description` | string | yes |
| `color` | `"red"` \| `"orange"` \| `"green"` \| `"blue"` | yes |
| `active` | boolean | yes |
| `visibleFrom` | ISO-8601 string | no |
| `visibleUntil` | ISO-8601 string | no |
| `createdAt` | ISO-8601 | — |
| `updatedAt` | ISO-8601 | — |

### Endpoints

| Method | Path | Body | Response `data` |
|---|---|---|---|
| `GET` | `/platform/announcements` | — | `{ "items": [...] }` |
| `POST` | `/platform/announcements` | Create input | `{ "item": {...} }` |
| `PATCH` | `/platform/announcements/:id` | Partial update | `{ "item": {...} }` |
| `DELETE` | `/platform/announcements/:id` | — | `{ "deletedId": "uuid" }` |

### Create request body

```json
{
  "title": "System maintenance window",
  "description": "Planned downtime on Saturday 21:00–23:00.",
  "body": { "type": "doc", "content": [] },
  "color": "orange",
  "active": true,
  "visibleFrom": "2026-06-14T19:00:00.000Z",
  "visibleUntil": "2026-06-14T23:00:00.000Z"
}
```

---

## 6. Platform Links (Global Quick Links)

**Base path:** `/platform/links`

### Record shape

| Field | Type |
|---|---|
| `id` | string (UUID) |
| `title` | string |
| `url` | string |
| `description` | string |
| `icon` | string |
| `sortOrder` | number |
| `openInNewTab` | boolean |
| `isInternal` | boolean |

### Endpoints

| Method | Path | Body | Response `data` |
|---|---|---|---|
| `GET` | `/platform/links` | — | `{ "items": [...] }` |
| `POST` | `/platform/links` | Create input | `{ "item": {...} }` |
| `PATCH` | `/platform/links/:id` | Partial update | `{ "item": {...} }` |
| `DELETE` | `/platform/links/:id` | — | `{ "deletedId": "uuid" }` |

### Create request body

```json
{
  "title": "HR Portal",
  "url": "https://hr.example.com",
  "description": "Leave requests and payslips.",
  "icon": "user",
  "openInNewTab": true,
  "isInternal": false
}
```

---

## 7. Project Bootstrap & Configuration

### `GET /projects/:projectSlug/bootstrap`

Returns project-level capabilities, module configuration, and a content snapshot. Module providers still fetch their own endpoints for authoritative lists; bootstrap seeds capabilities and shell config.

```json
{
  "project": { "id": "uuid", "slug": "altcloud", "code": "ALT", "name": "AltCloud" },
  "access": {
    "isVisible": true,
    "isLocked": false,
    "effectiveProjectRole": "project_admin"
  },
  "capabilities": {
    "project": {
      "canEnterProject": true,
      "canEditContent": true,
      "canManageModules": true,
      "canUploadFiles": true,
      "canViewAudit": true
    },
    "modules": {
      "phrases": { "enabled": true, "canView": true, "canCreate": true, "canEdit": true, "canDelete": true }
    }
  },
  "configuration": {
    "navigation": ["home", "matrix", "phrases", "contacts"],
    "rules": {
      "matrixCategoryOrder": ["Reklamacje", "Zwroty"],
      "matrixAdvisoryRules": []
    },
    "homeSpotlights": [],
    "leadConfig": { "questions": [], "rules": [] }
  }
}
```

### Other project configuration endpoints

| Method | Path | Body |
|---|---|---|
| `PATCH` | `/projects/:projectSlug` | `{ "slug", "code", "name" }` |
| `PATCH` | `/projects/:projectSlug/modules/:moduleKey` | `{ "enabled"?: boolean, "settings"?: object }` |
| `PUT` | `/projects/:projectSlug/navigation` | `{ "orderedModuleKeys": ["matrix", "phrases", "contacts"] }` |
| `PUT` | `/projects/:projectSlug/home-spotlights` | `{ "items": [{ "id", "pageId", "labelOverride", "sortOrder" }] }` |
| `PUT` | `/projects/:projectSlug/lead-config` | Full `LeadConfig` object (see below) |

**Module key mapping** — use backend keys in URLs, not the Polish frontend route keys:

| Frontend route key | Backend module key | URL path segment |
|---|---|---|
| `kontakty` | `contacts` | `/contacts` |
| `zwroty` | `phrases` | `/phrases` |
| `linki` | `links` | `/links` |
| `matrix` | `matrix` | `/matrix` |
| `ogłoszenia` | `announcements` | `/announcements` |
| `cenniki` | `pricing` | `/pricing` |
| `komunikaty` | `communications` | `/communications` |
| `szablony` | `templates` | `/templates` |
| `tematOrg` | `important_topics` | `/important-topics` |
| `formularze` | `forms` | `/forms` |

---

## 8. Contacts

**Base path:** `/projects/:projectSlug/contacts`

### Record shape

| Field | Type |
|---|---|
| `id` | string (UUID) |
| `title` | string |
| `description` | string |
| `phone` | string \| null |
| `email` | string \| null |
| `address` | string \| null |
| `detailTable` | `ContactDetailTable` \| null |
| `group` | `"wewnetrzne"` \| `"zewnetrzne"` |
| `sortOrder` | number |

### Endpoints

| Method | Path | Body | Response `data` |
|---|---|---|---|
| `GET` | `/projects/:projectSlug/contacts` | — | `{ project, items }` |
| `POST` | `/projects/:projectSlug/contacts` | Create input | `{ project, item }` |
| `PATCH` | `/projects/:projectSlug/contacts/:id` | Partial update | `{ project, item }` |
| `DELETE` | `/projects/:projectSlug/contacts/:id` | — | `{ project, deletedId }` |
| `POST` | `/projects/:projectSlug/contacts/reorder` | `{ "orderedIds": ["uuid1", "uuid2"] }` | `{ project, items }` (full list) |

### Create request body

```json
{
  "title": "Customer Support",
  "description": "Main customer-facing support line.",
  "phone": "+48 22 123 45 67",
  "email": "support@example.com",
  "address": null,
  "detailTable": null,
  "group": "wewnetrzne"
}
```

### `ContactDetailTable` shape

Used for structured lookup tables embedded within a contact record:

```json
{
  "title": "Escalation paths",
  "sectionHeader": "Team",
  "itemsHeader": "Issue type",
  "actionHeader": "Action",
  "sections": [
    {
      "id": "sec-1",
      "label": "Tier 1",
      "groups": [
        { "id": "g-1", "items": "Billing queries\nAccount issues", "action": "Email billing@" }
      ]
    }
  ],
  "notes": "Last reviewed 2026-05."
}
```

---

## 9. Phrases (Ready-made Responses)

**Base path:** `/projects/:projectSlug/phrases`

### Record shape

| Field | Type | Constraints |
|---|---|---|
| `id` | string (UUID) | — |
| `title` | string | max 200 chars |
| `content` | string | max 20 000 chars |
| `requiresConfirmation` | boolean | default `false` |
| `sortOrder` | number | int ≥ 0 |

### Endpoints

| Method | Path | Body | Response `data` |
|---|---|---|---|
| `GET` | `/projects/:projectSlug/phrases` | — | `{ project, items }` |
| `POST` | `/projects/:projectSlug/phrases` | Create input | `{ project, item }` |
| `PATCH` | `/projects/:projectSlug/phrases/:id` | Partial update | `{ project, item }` |
| `DELETE` | `/projects/:projectSlug/phrases/:id` | — | `{ project, deletedId }` |
| `POST` | `/projects/:projectSlug/phrases/reorder` | `{ "orderedIds": ["uuid1", "uuid2"] }` | `{ project, items }` (full list) |

### Create request body

```json
{
  "title": "Standard refund confirmation",
  "content": "Dear Customer, your refund of {amount} has been processed and will appear within 5 business days.",
  "requiresConfirmation": true
}
```

---

## 10. Links

**Base path:** `/projects/:projectSlug/links`

### Record shape

| Field | Type |
|---|---|
| `id` | string (UUID) |
| `title` | string |
| `url` | string |
| `description` | string |
| `icon` | string |
| `sortOrder` | number |
| `openInNewTab` | boolean |
| `isInternal` | boolean |

### Endpoints

| Method | Path | Body | Response `data` |
|---|---|---|---|
| `GET` | `/projects/:projectSlug/links` | — | `{ project, items }` |
| `POST` | `/projects/:projectSlug/links` | Create input | `{ project, item }` |
| `PATCH` | `/projects/:projectSlug/links/:id` | Partial update | `{ project, item }` |
| `DELETE` | `/projects/:projectSlug/links/:id` | — | `{ project, deletedId }` |
| `POST` | `/projects/:projectSlug/links/reorder` | `{ "orderedIds": ["uuid1", "uuid2"] }` | `{ project, items }` |

### Create request body

```json
{
  "title": "Internal CRM",
  "url": "https://crm.internal.example.com",
  "description": "Salesforce instance for account management.",
  "icon": "database",
  "openInNewTab": true,
  "isInternal": true
}
```

---

## 11. Quick Links

**Base path:** `/projects/:projectSlug/quick-links`

Identical shape and endpoint structure to [Links](#10-links) except the record uses `label` instead of `title`.

| Field | Type |
|---|---|
| `id` | string (UUID) |
| `label` | string |
| `url` | string |
| `icon` | string |
| `sortOrder` | number |
| `openInNewTab` | boolean |
| `isInternal` | boolean |

### Endpoints

| Method | Path | Body | Response `data` |
|---|---|---|---|
| `GET` | `/projects/:projectSlug/quick-links` | — | `{ project, items }` |
| `POST` | `/projects/:projectSlug/quick-links` | Create input | `{ project, item }` |
| `PATCH` | `/projects/:projectSlug/quick-links/:id` | Partial update | `{ project, item }` |
| `DELETE` | `/projects/:projectSlug/quick-links/:id` | — | `{ project, deletedId }` |
| `POST` | `/projects/:projectSlug/quick-links/reorder` | `{ "orderedIds": ["uuid1", "uuid2"] }` | `{ project, items }` |

### Create request body

```json
{
  "label": "Daily standup",
  "url": "https://meet.example.com/standup",
  "icon": "video",
  "openInNewTab": true,
  "isInternal": false
}
```

---

## 12. Announcements

**Base path:** `/projects/:projectSlug/announcements`

Same record shape as [Platform Announcements](#5-platform-announcements). Project-scoped — no `reorder` endpoint.

### Endpoints

| Method | Path | Body | Response `data` |
|---|---|---|---|
| `GET` | `/projects/:projectSlug/announcements` | — | `{ project, items }` |
| `POST` | `/projects/:projectSlug/announcements` | Create input | `{ project, item }` |
| `PATCH` | `/projects/:projectSlug/announcements/:id` | Partial update | `{ project, item }` |
| `DELETE` | `/projects/:projectSlug/announcements/:id` | — | `{ project, deletedId }` |

### Create request body

```json
{
  "title": "New return policy effective July 1",
  "description": "Customers now have 60 days to return unopened items.",
  "body": { "type": "doc", "content": [] },
  "color": "blue",
  "active": true,
  "visibleFrom": "2026-07-01T00:00:00.000Z",
  "visibleUntil": null
}
```

---

## 13. Matrix (Decision Board)

**Base path:** `/projects/:projectSlug/matrix`

The Matrix is a structured decision table — each entry belongs to a category and subcategory, carries keywords, SLA, and routing conditions.

### Record shape

| Field | Type |
|---|---|
| `id` | string (UUID) |
| `category` | string |
| `subcategory` | string |
| `keywords` | string[] |
| `description` | string |
| `slaDays` | number |
| `instructions` | string |
| `additionalNotes` | string |
| `defaultDepartment` | string |
| `conditions` | `MatrixCondition[]` |
| `linkedTemplateIds` | string[] |
| `sortOrder` | number |
| `createdAt` | ISO-8601 |
| `updatedAt` | ISO-8601 |

**`MatrixCondition`:**

```json
{
  "department": "Logistics",
  "criteria": [
    { "field": "channel", "value": "email" }
  ]
}
```

### Endpoints

| Method | Path | Body | Response `data` |
|---|---|---|---|
| `GET` | `/projects/:projectSlug/matrix` | — | `{ project, items }` |
| `POST` | `/projects/:projectSlug/matrix` | Create input | `{ project, item }` |
| `PATCH` | `/projects/:projectSlug/matrix/:id` | Partial update | `{ project, item }` |
| `DELETE` | `/projects/:projectSlug/matrix/:id` | — | `{ project, deletedId }` |
| `POST` | `/projects/:projectSlug/matrix/categories/reorder` | `{ "orderedCategoryNames": ["Returns", "Complaints"] }` | `{ project, orderedCategoryNames }` |
| `POST` | `/projects/:projectSlug/matrix/reorder` | `{ "category": "Returns", "orderedIds": ["uuid1", "uuid2"] }` | `{ project, items }` |

### Create request body

```json
{
  "category": "Returns",
  "subcategory": "Damaged goods",
  "keywords": ["damage", "broken", "defective"],
  "description": "Customer reporting a damaged item on arrival.",
  "slaDays": 3,
  "instructions": "Issue a prepaid return label. Log the case in the damage tracker.",
  "additionalNotes": "Photograph required for claims over 500 PLN.",
  "defaultDepartment": "Returns",
  "conditions": [
    { "department": "Insurance", "criteria": [{ "field": "value", "value": "high" }] }
  ],
  "linkedTemplateIds": []
}
```

---

## 14. Knowledge Base — Categories

**Base path:** `/projects/:projectSlug/categories`

### Record shape

| Field | Type |
|---|---|
| `id` | string (UUID) |
| `slug` | string |
| `name` | string |
| `description` | string \| null |
| `parentId` | string \| null |
| `sortOrder` | number |
| `childOrder` | string[] (optional) |

### Endpoints

| Method | Path | Body | Response `data` |
|---|---|---|---|
| `GET` | `/projects/:projectSlug/categories` | — | `{ project, items }` |
| `POST` | `/projects/:projectSlug/categories` | Create input | `{ project, item }` |
| `PATCH` | `/projects/:projectSlug/categories/:id` | Partial update | `{ project, item }` |
| `DELETE` | `/projects/:projectSlug/categories/:id` | — | HTTP 2xx, empty body |
| `POST` | `/projects/:projectSlug/categories/reorder` | Reorder input (see below) | Full category list |

### Reorder request body (two modes)

Reorder sibling categories:

```json
{ "mode": "siblings", "parentId": null, "orderedIds": ["uuid1", "uuid2", "uuid3"] }
```

Reorder children within a category:

```json
{ "mode": "childOrder", "categoryId": "parent-uuid", "orderedIds": ["article-uuid", "child-cat-uuid"] }
```

### Create request body

```json
{
  "name": "Shipping & Delivery",
  "slug": "shipping-delivery",
  "description": "All guides related to shipping and delivery options.",
  "parentId": null
}
```

---

## 15. Knowledge Base — Articles

**Base path:** `/projects/:projectSlug/articles`

### Record shape

| Field | Type |
|---|---|
| `id` | string (UUID) |
| `categoryId` | string |
| `categorySlug` | string |
| `slug` | string |
| `title` | string |
| `summary` | string |
| `author` | string \| null |
| `updatedAt` | ISO-8601 |
| `tags` | string[] |
| `hiddenTags` | string[] |
| `sections` | `ArticleSection[]` |
| `sortOrder` | number |

**`ArticleSection`:**

```json
{
  "id": "section-uuid",
  "title": "Overview",
  "collapsible": false,
  "showSeparator": true,
  "tags": [],
  "jsonContent": { "type": "doc", "content": [] }
}
```

### Endpoints

| Method | Path | Body | Response `data` |
|---|---|---|---|
| `GET` | `/projects/:projectSlug/articles` | — | `{ project, items }` |
| `POST` | `/projects/:projectSlug/articles` | Create input | `{ project, item }` |
| `PATCH` | `/projects/:projectSlug/articles/:id` | Partial update | `{ project, item }` |
| `DELETE` | `/projects/:projectSlug/articles/:id` | — | HTTP 2xx, empty body |
| `POST` | `/projects/:projectSlug/articles/reorder` | `{ "categoryId": "uuid", "orderedIds": ["uuid1"] }` | Full articles list |

### Create request body

```json
{
  "categoryId": "cat-uuid",
  "categorySlug": "shipping-delivery",
  "slug": "how-to-track-parcel",
  "title": "How to track your parcel",
  "summary": "Step-by-step guide to locating a shipment in real time.",
  "author": "Jane Smith",
  "tags": ["tracking", "parcel", "shipping"],
  "hiddenTags": [],
  "sections": [
    {
      "id": "s1",
      "title": "Using the tracking portal",
      "collapsible": false,
      "showSeparator": true,
      "tags": [],
      "jsonContent": { "type": "doc", "content": [] }
    }
  ]
}
```

---

## 16. Communications

**Base path:** `/projects/:projectSlug/communications`

### Record shape

| Field | Type |
|---|---|
| `id` | string (UUID) |
| `title` | string |
| `body` | TipTap JSON |
| `status` | `"active"` \| `"archived"` |
| `communicationDate` | `YYYY-MM-DD` \| null |
| `createdAt` | ISO-8601 |
| `updatedAt` | ISO-8601 |

### Endpoints

| Method | Path | Body | Response `data` |
|---|---|---|---|
| `GET` | `/projects/:projectSlug/communications` | — | `{ project, items }` |
| `POST` | `/projects/:projectSlug/communications` | Create input | `{ project, item }` |
| `PATCH` | `/projects/:projectSlug/communications/:id` | Partial update | `{ project, item }` |
| `DELETE` | `/projects/:projectSlug/communications/:id` | — | `{ project, deletedId }` |

### Create request body

```json
{
  "title": "Q2 procedural update",
  "body": { "type": "doc", "content": [] },
  "status": "active",
  "communicationDate": "2026-04-01"
}
```

---

## 17. Templates

**Base path:** `/projects/:projectSlug/templates`

### Record shape

| Field | Type |
|---|---|
| `id` | string (UUID) |
| `title` | string |
| `channel` | `"email"` \| `"zgloszenie"` |
| `body` | TipTap JSON |
| `example` | TipTap JSON |
| `sortOrder` | number |
| `createdAt` | ISO-8601 |
| `updatedAt` | ISO-8601 |

### Endpoints

| Method | Path | Body | Response `data` |
|---|---|---|---|
| `GET` | `/projects/:projectSlug/templates` | — | `{ project, items }` |
| `POST` | `/projects/:projectSlug/templates` | Create input | `{ project, item }` |
| `PATCH` | `/projects/:projectSlug/templates/:id` | Partial update | `{ project, item }` |
| `DELETE` | `/projects/:projectSlug/templates/:id` | — | `{ project, deletedId }` |
| `POST` | `/projects/:projectSlug/templates/reorder` | `{ "orderedIds": ["uuid1", "uuid2"] }` | `{ project, items }` |

### Create request body

```json
{
  "title": "Refund acknowledgement email",
  "channel": "email",
  "body": { "type": "doc", "content": [] },
  "example": { "type": "doc", "content": [] }
}
```

---

## 18. Pricing Tables

**Base path:** `/projects/:projectSlug/pricing`

### Record shape

| Field | Type |
|---|---|
| `id` | string (UUID) |
| `title` | string |
| `subtitle` | string \| null |
| `provider` | string \| null |
| `effectiveFrom` | `YYYY-MM-DD` |
| `status` | `"active"` \| `"archived"` |
| `footnotes` | string[] |
| `sections` | `PricingSection[]` |
| `createdAt` | ISO-8601 |
| `updatedAt` | ISO-8601 |

**`PricingSection`** — discriminated union by `type`:

Table section:

```json
{
  "type": "table",
  "id": "section-uuid",
  "title": "Standard tariff",
  "unit": "PLN",
  "columns": [{ "key": "col_a", "label": "0–5 kg" }, { "key": "col_b", "label": "5–20 kg" }],
  "rows": [
    { "id": "row-1", "label": "Economy", "values": { "col_a": "12.00", "col_b": "18.50" } }
  ]
}
```

Charges section:

```json
{
  "type": "charges",
  "id": "section-uuid",
  "title": "Additional fees",
  "items": [
    {
      "id": "item-1",
      "name": "Fuel surcharge",
      "unit": "PLN",
      "variants": [{ "id": "v1", "conditions": "Domestic", "value": "2.50" }]
    }
  ]
}
```

### Endpoints

| Method | Path | Body | Response `data` |
|---|---|---|---|
| `GET` | `/projects/:projectSlug/pricing` | — | `{ project, items }` |
| `POST` | `/projects/:projectSlug/pricing` | Create input | `{ project, item }` |
| `PATCH` | `/projects/:projectSlug/pricing/:id` | Partial update | `{ project, item }` |
| `DELETE` | `/projects/:projectSlug/pricing/:id` | — | `{ project, deletedId }` |

### Create request body

```json
{
  "title": "Domestic shipping — 2026 Q3",
  "subtitle": null,
  "provider": "DHL",
  "effectiveFrom": "2026-07-01",
  "status": "active",
  "footnotes": ["Prices include VAT.", "Weekend surcharge applies Saturday–Sunday."],
  "sections": []
}
```

---

## 19. Important Topics

**Base path:** `/projects/:projectSlug/important-topics`

### Record shape

| Field | Type |
|---|---|
| `id` | string (UUID) |
| `title` | string |
| `body` | TipTap JSON |
| `status` | `"active"` \| `"archived"` |
| `entryDate` | `YYYY-MM-DD` \| null |
| `createdAt` | ISO-8601 |
| `updatedAt` | ISO-8601 |

### Endpoints

| Method | Path | Body | Response `data` |
|---|---|---|---|
| `GET` | `/projects/:projectSlug/important-topics` | — | `{ project, items }` |
| `POST` | `/projects/:projectSlug/important-topics` | Create input | `{ project, item }` |
| `PATCH` | `/projects/:projectSlug/important-topics/:id` | Partial update | `{ project, item }` |
| `DELETE` | `/projects/:projectSlug/important-topics/:id` | — | `{ project, deletedId }` |

### Create request body

```json
{
  "title": "GDPR compliance — annual review",
  "body": { "type": "doc", "content": [] },
  "status": "active",
  "entryDate": "2026-06-01"
}
```

---

## 20. Forms

**Base path:** `/projects/:projectSlug/forms`

### Form record shape

| Field | Type |
|---|---|
| `id` | string (UUID) |
| `slug` | string |
| `title` | string |
| `description` | string |
| `isActive` | boolean |
| `sortOrder` | number |
| `fields` | `FormField[]` |
| `createdAt` | ISO-8601 |
| `updatedAt` | ISO-8601 |

**`FormField`:**

```json
{
  "id": "field-1",
  "label": "Reason for contact",
  "type": "select",
  "required": true,
  "placeholder": "Choose a reason…",
  "options": [
    { "value": "complaint", "label": "Complaint" },
    { "value": "inquiry", "label": "Inquiry" }
  ]
}
```

Field `type` enum: `"text"` | `"textarea"` | `"select"` | `"checkbox"`

### Endpoints

| Method | Path | Body | Response `data` |
|---|---|---|---|
| `GET` | `/projects/:projectSlug/forms` | — | Active forms (public) |
| `GET` | `/projects/:projectSlug/forms/admin` | — | All forms (admin) |
| `POST` | `/projects/:projectSlug/forms` | Create input | `{ project, item }` |
| `PATCH` | `/projects/:projectSlug/forms/:id` | Partial update | `{ project, item }` |
| `DELETE` | `/projects/:projectSlug/forms/:id` | — | `{ project, deletedId }` |
| `POST` | `/projects/:projectSlug/forms/:id/submissions` | `{ "answers": { "fieldId": "value" } }` | `{ project, submission }` |
| `GET` | `/projects/:projectSlug/forms/submissions` | Query: `formId?`, `limit?` | `{ project, items }` |

---

## 21. Audit History

### Project audit

**`GET /projects/:projectSlug/audit`**

Query parameters:

| Parameter | Type | Description |
|---|---|---|
| `limit` | number | Page size |
| `beforeId` | string | Cursor for pagination |
| `actionType` | `create` \| `update` \| `delete` | Filter |
| `entityType` | string | Filter |
| `moduleKey` | string | Filter |

**Response `data`:**

```json
{
  "project": { "id": "uuid", "slug": "altcloud", "code": "ALT", "name": "AltCloud" },
  "filters": { "limit": 50, "beforeId": null },
  "items": [
    {
      "id": "uuid",
      "occurredAt": "2026-06-09T10:00:00.000Z",
      "actionType": "create",
      "actionLabel": "Created",
      "entityType": "phrase",
      "entityLabel": "Phrase",
      "entityId": "uuid",
      "entityTitle": "Standard refund confirmation",
      "areaKey": "content",
      "areaLabel": "Content",
      "moduleKey": "phrases",
      "moduleLabel": "Phrases",
      "summary": "Created phrase \"Standard refund confirmation\"",
      "actor": { "id": "uuid", "displayName": "Admin User", "email": "admin@example.com", "globalRole": "super_admin" },
      "project": { "id": "uuid", "slug": "altcloud", "code": "ALT", "name": "AltCloud" },
      "changedFields": [],
      "metadata": null
    }
  ],
  "pageInfo": { "hasMore": false, "nextBeforeId": null }
}
```

### Platform audit

**`GET /platform/audit`** — same query parameters, adds optional `projectSlug` filter. `data.scope` is `"global"`.

---

## 22. File Upload

### `POST /api/v1/uploads`

> **This endpoint is outside the standard `/api/v1` module path hierarchy** and does **not** return the standard `{ data, meta }` envelope.

**Request:** `multipart/form-data`

| Field | Required | Description |
|---|---|---|
| `file` | yes | The file binary |
| `projectSlug` | no | Associates upload with a project |
| `kind` | no | `"image"` \| `"video"` \| `"file"` |
| `folder` | no | Storage subfolder hint |

**Success response — HTTP `201`:**

```json
{
  "url": "https://host/photos/2026/06/photo-abc123.jpg",
  "file": {
    "mediaKind": "image",
    "url": "https://host/photos/2026/06/photo-abc123.jpg",
    "path": "/photos/2026/06/photo-abc123.jpg",
    "mimeType": "image/jpeg",
    "sizeBytes": 204800
  }
}
```

The frontend reads `url` or `file.url` — both are valid; prefer `url`.

**Upload size defaults** (returned in bootstrap `uploads.defaults`):

| Kind | Max size |
|---|---|
| image | 5 MB |
| file | 10 MB |
| video | 500 MB |

**Error codes specific to upload:**

| Code | HTTP | Meaning |
|---|---|---|
| `UPLOAD_TOO_LARGE` | 413 | File exceeds size limit |
| `UNSUPPORTED_MEDIA_TYPE` | 415 | MIME type not permitted |
| `PROJECT_ACCESS_DENIED` | 403 | User cannot upload to this project |

Uploaded files are served statically under `/photos/`, `/videos/`, and `/files/` prefixes. Configure your reverse proxy to forward these paths to the API server.

---

## 23. Error Code Reference

| Code | HTTP | Meaning |
|---|---|---|
| `VALIDATION_ERROR` | 400 | Request body failed Zod validation; inspect `fieldErrors` |
| `GATEWAY_USER_NOT_FOUND` | 404 | Identity header value injected by the upstream gateway did not match any provisioned user — user account may not yet be provisioned |
| `PROJECT_NOT_FOUND` | 404 | Unknown `projectSlug` in URL |
| `PROJECT_ACCESS_DENIED` | 403 | Project is locked or user lacks access |
| `PLATFORM_PROJECT_FORBIDDEN` | 403 | Project creation requires `super_admin` |
| `PLATFORM_CONTENT_FORBIDDEN` | 403 | Platform-level content admin denied |
| `PLATFORM_ANNOUNCEMENT_NOT_FOUND` | 404 | Announcement ID not found |
| `PLATFORM_LINK_NOT_FOUND` | 404 | Link ID not found |
| `PLATFORM_AUDIT_FORBIDDEN` | 403 | Audit access denied |
| `PLATFORM_AUDIT_ERROR` | 500 | Internal error reading audit log |
| `SERVICE_UNREADY` | 503 | Database unreachable (`/health/ready`) |
| `UPLOAD_TOO_LARGE` | 413 | File exceeds configured size limit |
| `UNSUPPORTED_MEDIA_TYPE` | 415 | MIME type not allowed |

Module-specific `*_NOT_FOUND` codes (e.g. `PHRASE_NOT_FOUND`, `CONTACT_NOT_FOUND`) follow the same envelope pattern.

---

## 24. Client-Side Search Architecture

Global and project-scoped search are intentionally implemented as a **Client-Side In-Memory Indexing Strategy** — an architectural decision aligned with Jamstack and edge-delivery principles that eliminates database query overhead for search operations entirely.

### Design rationale

Rather than issuing round-trip database queries for every keystroke, the platform pre-loads all module data into application state during the bootstrap and project-bootstrap calls. The search engine then indexes and queries this in-memory state entirely on the client, delivering:

| Benefit | Description |
|---|---|
| Sub-millisecond filtering | No network latency on query execution — results are computed locally |
| Zero additional server load | Search generates no database I/O whatsoever |
| Offline resilience | Search continues to function if the network connection drops after initial load |
| Instant incremental results | Results update on every keystroke with no debounce delays or loading states |
| Simplified infrastructure | No search index (Elasticsearch, OpenSearch, etc.) to provision, scale, or maintain |

### Search scope

| Search type | Scope | Data populated from |
|---|---|---|
| Global search | All projects visible to the current user | `/platform/bootstrap` — loaded once on application initialisation |
| Project search | All enabled module records within one project | Each module's list endpoint — loaded as the user navigates into a project |

### Bootstrap capability block

The bootstrap response includes a `search` configuration block as a UI capability hint:

```json
{
  "search": {
    "globalSearchEnabled": true,
    "minQueryLength": 2
  }
}
```

`globalSearchEnabled` controls whether the search input is rendered in the platform shell. `minQueryLength` sets the minimum character threshold before the in-memory index is queried.

### Per-module indexed fields

Each module contributes the following fields to the client-side search index:

| Module | Indexed fields |
|---|---|
| Knowledge Base — Articles | `title`, `summary`, `tags`, `hiddenTags`, section `title` values |
| Knowledge Base — Categories | `name`, `description` |
| Matrix | `category`, `subcategory`, `description`, `keywords`, `instructions` |
| Contacts | `title`, `description`, `email`, `phone` |
| Phrases | `title`, `content` |
| Templates | `title` |
| Communications | `title` |
| Announcements | `title`, `description` |
| Links | `title`, `url`, `description` |
| Quick Links | `label`, `url` |

---

*This document reflects the production API contract as of June 2026. Update it whenever the API surface changes.*
