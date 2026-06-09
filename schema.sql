-- =============================================================================
-- PostgreSQL DDL – Intranet Platform
-- Generated from: prisma/schema.prisma
--
-- Requires: PostgreSQL 13+ (gen_random_uuid() is a built-in since PG 13).
--           For PG < 13, uncomment: CREATE EXTENSION IF NOT EXISTS "pgcrypto";
--
-- NOTE: `updated_at` columns are managed by the application layer (Prisma
--       @updatedAt). No DB-level trigger is generated here; add one if you
--       need purely DB-driven timestamp maintenance.
--
-- Execution order:
--   1. ENUM types
--   2. Tables  (no inline FK constraints — avoids forward-reference errors)
--   3. Unique indexes
--   4. Regular indexes
--   5. Foreign-key constraints (ALTER TABLE … ADD CONSTRAINT)
-- =============================================================================


-- =============================================================================
-- SECTION 1: CUSTOM ENUM TYPES
-- =============================================================================

CREATE TYPE "GlobalRole" AS ENUM (
    'super_admin',
    'global_moderator',
    'user'
);

CREATE TYPE "ProjectRole" AS ENUM (
    'project_admin',
    'content_manager',
    'project_user'
);

CREATE TYPE "ModuleKey" AS ENUM (
    'matrix',
    'announcements',
    'communications',
    'templates',
    'pricing',
    'phrases',
    'links',
    'contacts',
    'forms',
    'important_topics',
    'quick_links',
    'home_sections',
    'lead'
);

CREATE TYPE "UserStatus" AS ENUM (
    'active',
    'disabled'
);

CREATE TYPE "MediaKind" AS ENUM (
    'image',
    'file',
    'video'
);

CREATE TYPE "AnnouncementColor" AS ENUM (
    'red',
    'orange',
    'green',
    'blue'
);

CREATE TYPE "ContactGroup" AS ENUM (
    'wewnetrzne',
    'zewnetrzne'
);

CREATE TYPE "TemplateChannel" AS ENUM (
    'email',
    'zgloszenie'
);

CREATE TYPE "PricingStatus" AS ENUM (
    'active',
    'archived'
);

CREATE TYPE "CommunicationStatus" AS ENUM (
    'active',
    'archived'
);

CREATE TYPE "CommunicationKind" AS ENUM (
    'communication',
    'organizational_topic'
);


-- =============================================================================
-- SECTION 2: TABLES
-- =============================================================================

-- ---------------------------------------------------------------------------
-- users
-- ---------------------------------------------------------------------------
CREATE TABLE users (
    id            UUID           NOT NULL DEFAULT gen_random_uuid(),
    email         VARCHAR(320)   NOT NULL,
    display_name  TEXT           NOT NULL,
    initials      VARCHAR(8)     NOT NULL,
    global_role   "GlobalRole"   NOT NULL DEFAULT 'user',
    status        "UserStatus"   NOT NULL DEFAULT 'active',
    last_login_at TIMESTAMPTZ(6),
    created_at    TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT users_pkey PRIMARY KEY (id)
);

-- ---------------------------------------------------------------------------
-- platform_announcements
-- ---------------------------------------------------------------------------
CREATE TABLE platform_announcements (
    id            UUID                NOT NULL DEFAULT gen_random_uuid(),
    title         TEXT                NOT NULL,
    body_jsonb    JSONB,
    description   TEXT                NOT NULL DEFAULT '',
    color         "AnnouncementColor" NOT NULL DEFAULT 'blue',
    active        BOOLEAN             NOT NULL DEFAULT TRUE,
    sort_order    INTEGER             NOT NULL DEFAULT 0,
    visible_from  TIMESTAMPTZ(6),
    visible_until TIMESTAMPTZ(6),
    created_at    TIMESTAMPTZ(6)      NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ(6)      NOT NULL,

    CONSTRAINT platform_announcements_pkey PRIMARY KEY (id)
);

-- ---------------------------------------------------------------------------
-- platform_links
-- ---------------------------------------------------------------------------
CREATE TABLE platform_links (
    id              UUID           NOT NULL DEFAULT gen_random_uuid(),
    title           TEXT           NOT NULL,
    url             TEXT           NOT NULL,
    description     TEXT           NOT NULL DEFAULT '',
    icon            VARCHAR(64)    NOT NULL,
    sort_order      INTEGER        NOT NULL DEFAULT 0,
    open_in_new_tab BOOLEAN        NOT NULL DEFAULT TRUE,
    is_internal     BOOLEAN        NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT platform_links_pkey PRIMARY KEY (id)
);

-- ---------------------------------------------------------------------------
-- projects
-- ---------------------------------------------------------------------------
CREATE TABLE projects (
    id          UUID           NOT NULL DEFAULT gen_random_uuid(),
    slug        TEXT           NOT NULL,
    code        TEXT           NOT NULL,
    name        TEXT           NOT NULL,
    description TEXT,
    is_listed   BOOLEAN        NOT NULL DEFAULT TRUE,
    is_active   BOOLEAN        NOT NULL DEFAULT TRUE,
    sort_order  INTEGER        NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT projects_pkey PRIMARY KEY (id)
);

-- ---------------------------------------------------------------------------
-- project_memberships
-- ---------------------------------------------------------------------------
CREATE TABLE project_memberships (
    id             UUID           NOT NULL DEFAULT gen_random_uuid(),
    project_id     UUID           NOT NULL,
    user_id        UUID           NOT NULL,
    effective_role "ProjectRole"  NOT NULL,
    updated_at     TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT project_memberships_pkey PRIMARY KEY (id)
);

-- ---------------------------------------------------------------------------
-- project_modules
-- ---------------------------------------------------------------------------
CREATE TABLE project_modules (
    id             UUID           NOT NULL DEFAULT gen_random_uuid(),
    project_id     UUID           NOT NULL,
    module_key     "ModuleKey"    NOT NULL,
    enabled        BOOLEAN        NOT NULL DEFAULT TRUE,
    nav_visible    BOOLEAN        NOT NULL DEFAULT TRUE,
    nav_order      INTEGER        NOT NULL DEFAULT 0,
    settings_jsonb JSONB,
    updated_at     TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT project_modules_pkey PRIMARY KEY (id)
);

-- ---------------------------------------------------------------------------
-- project_forms
-- ---------------------------------------------------------------------------
CREATE TABLE project_forms (
    id           UUID           NOT NULL DEFAULT gen_random_uuid(),
    project_id   UUID           NOT NULL,
    slug         VARCHAR(191)   NOT NULL,
    title        TEXT           NOT NULL,
    description  TEXT           NOT NULL DEFAULT '',
    is_active    BOOLEAN        NOT NULL DEFAULT TRUE,
    fields_jsonb JSONB          NOT NULL,
    sort_order   INTEGER        NOT NULL DEFAULT 0,
    created_at   TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT project_forms_pkey PRIMARY KEY (id)
);

-- ---------------------------------------------------------------------------
-- project_form_submissions
-- ---------------------------------------------------------------------------
CREATE TABLE project_form_submissions (
    id                     UUID           NOT NULL DEFAULT gen_random_uuid(),
    project_id             UUID           NOT NULL,
    form_id                UUID           NOT NULL,
    payload_jsonb          JSONB          NOT NULL,
    submitter_user_id      UUID,
    submitter_email        VARCHAR(320),
    submitter_first_name   TEXT,
    submitter_last_name    TEXT,
    submitter_display_name TEXT,
    delivery_status        VARCHAR(64)    NOT NULL DEFAULT 'not_configured',
    delivery_note          TEXT,
    created_at             TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),

    CONSTRAINT project_form_submissions_pkey PRIMARY KEY (id)
);

-- ---------------------------------------------------------------------------
-- project_quick_links
-- ---------------------------------------------------------------------------
CREATE TABLE project_quick_links (
    id              UUID           NOT NULL DEFAULT gen_random_uuid(),
    project_id      UUID           NOT NULL,
    label           TEXT           NOT NULL,
    url             TEXT           NOT NULL,
    icon            VARCHAR(64)    NOT NULL,
    sort_order      INTEGER        NOT NULL DEFAULT 0,
    open_in_new_tab BOOLEAN        NOT NULL DEFAULT TRUE,
    is_internal     BOOLEAN        NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT project_quick_links_pkey PRIMARY KEY (id)
);

-- ---------------------------------------------------------------------------
-- project_links
-- ---------------------------------------------------------------------------
CREATE TABLE project_links (
    id              UUID           NOT NULL DEFAULT gen_random_uuid(),
    project_id      UUID           NOT NULL,
    title           TEXT           NOT NULL,
    url             TEXT           NOT NULL,
    description     TEXT           NOT NULL DEFAULT '',
    icon            VARCHAR(64)    NOT NULL,
    sort_order      INTEGER        NOT NULL DEFAULT 0,
    open_in_new_tab BOOLEAN        NOT NULL DEFAULT TRUE,
    is_internal     BOOLEAN        NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT project_links_pkey PRIMARY KEY (id)
);

-- ---------------------------------------------------------------------------
-- project_announcements
-- ---------------------------------------------------------------------------
CREATE TABLE project_announcements (
    id            UUID                NOT NULL DEFAULT gen_random_uuid(),
    project_id    UUID                NOT NULL,
    title         TEXT                NOT NULL,
    body_jsonb    JSONB,
    description   TEXT                NOT NULL DEFAULT '',
    color         "AnnouncementColor" NOT NULL DEFAULT 'blue',
    active        BOOLEAN             NOT NULL DEFAULT TRUE,
    sort_order    INTEGER             NOT NULL DEFAULT 0,
    visible_from  TIMESTAMPTZ(6),
    visible_until TIMESTAMPTZ(6),
    created_at    TIMESTAMPTZ(6)      NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ(6)      NOT NULL,

    CONSTRAINT project_announcements_pkey PRIMARY KEY (id)
);

-- ---------------------------------------------------------------------------
-- project_contacts
-- "group" is quoted because GROUP is a reserved SQL keyword.
-- ---------------------------------------------------------------------------
CREATE TABLE project_contacts (
    id                 VARCHAR(191)   NOT NULL DEFAULT gen_random_uuid()::text,
    project_id         UUID           NOT NULL,
    title              TEXT           NOT NULL,
    description        TEXT           NOT NULL DEFAULT '',
    phone              VARCHAR(64),
    email              VARCHAR(320),
    address            TEXT,
    detail_table_jsonb JSONB,
    "group"            "ContactGroup" NOT NULL,
    sort_order         INTEGER        NOT NULL DEFAULT 0,
    created_at         TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT project_contacts_pkey PRIMARY KEY (id)
);

-- ---------------------------------------------------------------------------
-- project_knowledge_categories  (self-referential via parent_id)
-- ---------------------------------------------------------------------------
CREATE TABLE project_knowledge_categories (
    id          VARCHAR(191)   NOT NULL DEFAULT gen_random_uuid()::text,
    project_id  UUID           NOT NULL,
    slug        VARCHAR(191)   NOT NULL,
    name        TEXT           NOT NULL,
    description TEXT,
    parent_id   VARCHAR(191),
    sort_order  INTEGER        NOT NULL DEFAULT 0,
    child_order TEXT[]         NOT NULL DEFAULT '{}',
    created_at  TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT project_knowledge_categories_pkey PRIMARY KEY (id)
);

-- ---------------------------------------------------------------------------
-- project_knowledge_articles
-- ---------------------------------------------------------------------------
CREATE TABLE project_knowledge_articles (
    id                     VARCHAR(191)   NOT NULL DEFAULT gen_random_uuid()::text,
    project_id             UUID           NOT NULL,
    category_id            VARCHAR(191)   NOT NULL,
    slug                   VARCHAR(191)   NOT NULL,
    title                  TEXT           NOT NULL,
    summary                TEXT           NOT NULL DEFAULT '',
    author_name            TEXT,
    tags                   TEXT[]         NOT NULL DEFAULT '{}',
    hidden_tags            TEXT[]         NOT NULL DEFAULT '{}',
    matrix_link_id         VARCHAR(191),
    global_matrix_link_ids TEXT[]         NOT NULL DEFAULT '{}',
    key_data_points_jsonb  JSONB,
    quick_actions          TEXT[]         NOT NULL DEFAULT '{}',
    external_source_url    TEXT,
    section_search_enabled BOOLEAN        NOT NULL DEFAULT FALSE,
    sort_order             INTEGER        NOT NULL DEFAULT 0,
    created_at             TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
    updated_at             TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT project_knowledge_articles_pkey PRIMARY KEY (id)
);

-- ---------------------------------------------------------------------------
-- project_home_spotlights
-- ---------------------------------------------------------------------------
CREATE TABLE project_home_spotlights (
    id             VARCHAR(191)   NOT NULL DEFAULT gen_random_uuid()::text,
    project_id     UUID           NOT NULL,
    article_id     VARCHAR(191)   NOT NULL,
    label_override TEXT,
    sort_order     INTEGER        NOT NULL DEFAULT 0,
    created_at     TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT project_home_spotlights_pkey PRIMARY KEY (id)
);

-- ---------------------------------------------------------------------------
-- project_knowledge_article_sections
-- ---------------------------------------------------------------------------
CREATE TABLE project_knowledge_article_sections (
    id             VARCHAR(191)   NOT NULL DEFAULT gen_random_uuid()::text,
    article_id     VARCHAR(191)   NOT NULL,
    sort_order     INTEGER        NOT NULL DEFAULT 0,
    title          TEXT           NOT NULL,
    tags           TEXT[]         NOT NULL DEFAULT '{}',
    collapsible    BOOLEAN        NOT NULL DEFAULT FALSE,
    show_separator BOOLEAN        NOT NULL DEFAULT TRUE,
    body_jsonb     JSONB          NOT NULL,
    created_at     TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT project_knowledge_article_sections_pkey PRIMARY KEY (id)
);

-- ---------------------------------------------------------------------------
-- project_phrases
-- ---------------------------------------------------------------------------
CREATE TABLE project_phrases (
    id                    VARCHAR(191)   NOT NULL DEFAULT gen_random_uuid()::text,
    project_id            UUID           NOT NULL,
    title                 TEXT           NOT NULL,
    content               TEXT           NOT NULL,
    requires_confirmation BOOLEAN        NOT NULL DEFAULT FALSE,
    sort_order            INTEGER        NOT NULL DEFAULT 0,
    created_at            TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT project_phrases_pkey PRIMARY KEY (id)
);

-- ---------------------------------------------------------------------------
-- project_templates
-- ---------------------------------------------------------------------------
CREATE TABLE project_templates (
    id            VARCHAR(191)      NOT NULL DEFAULT gen_random_uuid()::text,
    project_id    UUID              NOT NULL,
    title         TEXT              NOT NULL,
    channel       "TemplateChannel" NOT NULL,
    body_jsonb    JSONB,
    example_jsonb JSONB,
    sort_order    INTEGER           NOT NULL DEFAULT 0,
    created_at    TIMESTAMPTZ(6)    NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ(6)    NOT NULL,

    CONSTRAINT project_templates_pkey PRIMARY KEY (id)
);

-- ---------------------------------------------------------------------------
-- project_communications
-- ---------------------------------------------------------------------------
CREATE TABLE project_communications (
    id                 VARCHAR(191)         NOT NULL DEFAULT gen_random_uuid()::text,
    project_id         UUID                 NOT NULL,
    kind               "CommunicationKind"  NOT NULL DEFAULT 'communication',
    title              TEXT                 NOT NULL,
    body_jsonb         JSONB,
    status             "CommunicationStatus" NOT NULL DEFAULT 'active',
    communication_date DATE,
    created_at         TIMESTAMPTZ(6)       NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMPTZ(6)       NOT NULL,

    CONSTRAINT project_communications_pkey PRIMARY KEY (id)
);

-- ---------------------------------------------------------------------------
-- project_pricing_documents
-- ---------------------------------------------------------------------------
CREATE TABLE project_pricing_documents (
    id             VARCHAR(191)    NOT NULL DEFAULT gen_random_uuid()::text,
    project_id     UUID            NOT NULL,
    title          TEXT            NOT NULL,
    subtitle       TEXT,
    provider       TEXT,
    effective_from DATE            NOT NULL,
    status         "PricingStatus" NOT NULL DEFAULT 'active',
    footnotes      TEXT[]          NOT NULL DEFAULT '{}',
    sections_jsonb JSONB           NOT NULL,
    created_at     TIMESTAMPTZ(6)  NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ(6)  NOT NULL,

    CONSTRAINT project_pricing_documents_pkey PRIMARY KEY (id)
);

-- ---------------------------------------------------------------------------
-- project_matrix_entries
-- ---------------------------------------------------------------------------
CREATE TABLE project_matrix_entries (
    id                  VARCHAR(191)   NOT NULL DEFAULT gen_random_uuid()::text,
    project_id          UUID           NOT NULL,
    category            TEXT           NOT NULL,
    subcategory         TEXT           NOT NULL,
    keywords            TEXT[]         NOT NULL DEFAULT '{}',
    description         TEXT           NOT NULL DEFAULT '',
    sla_days            INTEGER        NOT NULL DEFAULT 1,
    instructions        TEXT           NOT NULL DEFAULT '',
    additional_notes    TEXT           NOT NULL DEFAULT '',
    default_department  TEXT           NOT NULL DEFAULT '',
    conditions_jsonb    JSONB          NOT NULL,
    linked_template_ids TEXT[]         NOT NULL DEFAULT '{}',
    sort_order          INTEGER        NOT NULL DEFAULT 0,
    created_at          TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT project_matrix_entries_pkey PRIMARY KEY (id)
);

-- ---------------------------------------------------------------------------
-- upload_policies
-- project_id is nullable: NULL means a platform-level (global) policy.
-- ---------------------------------------------------------------------------
CREATE TABLE upload_policies (
    id                    UUID           NOT NULL DEFAULT gen_random_uuid(),
    project_id            UUID,
    media_kind            "MediaKind"    NOT NULL,
    max_bytes             BIGINT         NOT NULL,
    allowed_mime_patterns TEXT[]         NOT NULL DEFAULT '{}',
    created_at            TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT upload_policies_pkey PRIMARY KEY (id)
);

-- ---------------------------------------------------------------------------
-- audit_log
-- Uses BIGSERIAL for high-volume append-only writes.
-- actor_user_id / project_id are nullable (SET NULL on referenced row delete).
-- ---------------------------------------------------------------------------
CREATE TABLE audit_log (
    id             BIGSERIAL,
    occurred_at    TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
    actor_user_id  UUID,
    project_id     UUID,
    module_key     "ModuleKey",
    entity_type    VARCHAR(64)    NOT NULL,
    entity_id      VARCHAR(191),
    action_type    VARCHAR(32)    NOT NULL,
    metadata_jsonb JSONB,

    CONSTRAINT audit_log_pkey PRIMARY KEY (id)
);


-- =============================================================================
-- SECTION 3: UNIQUE INDEXES
-- =============================================================================

-- users
CREATE UNIQUE INDEX users_email_key
    ON users (email);

-- projects
CREATE UNIQUE INDEX projects_slug_key
    ON projects (slug);

CREATE UNIQUE INDEX projects_code_key
    ON projects (code);

-- project_memberships
CREATE UNIQUE INDEX project_memberships_project_id_user_id_key
    ON project_memberships (project_id, user_id);

-- project_modules
CREATE UNIQUE INDEX project_modules_project_id_module_key_key
    ON project_modules (project_id, module_key);

-- project_forms
CREATE UNIQUE INDEX project_forms_project_id_slug_key
    ON project_forms (project_id, slug);

-- project_home_spotlights
CREATE UNIQUE INDEX project_home_spotlights_project_id_article_id_key
    ON project_home_spotlights (project_id, article_id);

-- project_knowledge_categories
CREATE UNIQUE INDEX project_knowledge_categories_project_id_slug_key
    ON project_knowledge_categories (project_id, slug);

-- project_knowledge_articles
CREATE UNIQUE INDEX project_knowledge_articles_project_category_slug_key
    ON project_knowledge_articles (project_id, category_id, slug);

-- upload_policies
CREATE UNIQUE INDEX upload_policies_project_id_media_kind_key
    ON upload_policies (project_id, media_kind);


-- =============================================================================
-- SECTION 4: REGULAR INDEXES
-- =============================================================================

-- users
CREATE INDEX users_global_role_status_idx
    ON users (global_role, status);

-- platform_announcements
CREATE INDEX platform_announcements_sort_order_created_at_idx
    ON platform_announcements (sort_order, created_at);

CREATE INDEX platform_announcements_active_visible_window_idx
    ON platform_announcements (active, visible_from, visible_until);

-- platform_links
CREATE INDEX platform_links_sort_order_title_idx
    ON platform_links (sort_order, title);

-- projects
CREATE INDEX projects_is_listed_sort_order_name_idx
    ON projects (is_listed, sort_order, name);

-- project_memberships
CREATE INDEX project_memberships_user_id_effective_role_idx
    ON project_memberships (user_id, effective_role);

-- project_modules
CREATE INDEX project_modules_project_id_enabled_nav_order_idx
    ON project_modules (project_id, enabled, nav_order);

-- project_forms
CREATE INDEX project_forms_project_id_sort_order_title_idx
    ON project_forms (project_id, sort_order, title);

-- project_form_submissions
CREATE INDEX project_form_submissions_project_id_form_id_created_at_idx
    ON project_form_submissions (project_id, form_id, created_at);

CREATE INDEX project_form_submissions_project_id_created_at_idx
    ON project_form_submissions (project_id, created_at);

-- project_home_spotlights
CREATE INDEX project_home_spotlights_project_id_sort_order_idx
    ON project_home_spotlights (project_id, sort_order);

-- project_quick_links
CREATE INDEX project_quick_links_project_id_sort_order_label_idx
    ON project_quick_links (project_id, sort_order, label);

-- project_links
CREATE INDEX project_links_project_id_sort_order_title_idx
    ON project_links (project_id, sort_order, title);

-- project_announcements
CREATE INDEX project_announcements_project_id_sort_order_created_at_idx
    ON project_announcements (project_id, sort_order, created_at);

CREATE INDEX project_announcements_project_id_active_visible_window_idx
    ON project_announcements (project_id, active, visible_from, visible_until);

-- project_contacts  ("group" is a reserved keyword — must be quoted)
CREATE INDEX project_contacts_project_id_sort_order_title_idx
    ON project_contacts (project_id, sort_order, title);

CREATE INDEX project_contacts_project_id_group_sort_order_idx
    ON project_contacts (project_id, "group", sort_order);

-- project_knowledge_categories
CREATE INDEX project_knowledge_categories_project_parent_sort_idx
    ON project_knowledge_categories (project_id, parent_id, sort_order);

CREATE INDEX project_knowledge_categories_project_sort_name_idx
    ON project_knowledge_categories (project_id, sort_order, name);

-- project_knowledge_articles
CREATE INDEX project_knowledge_articles_project_category_sort_idx
    ON project_knowledge_articles (project_id, category_id, sort_order);

CREATE INDEX project_knowledge_articles_project_updated_idx
    ON project_knowledge_articles (project_id, updated_at);

-- project_knowledge_article_sections
CREATE INDEX project_knowledge_article_sections_article_sort_idx
    ON project_knowledge_article_sections (article_id, sort_order);

-- project_phrases
CREATE INDEX project_phrases_project_id_sort_order_title_idx
    ON project_phrases (project_id, sort_order, title);

-- project_templates
CREATE INDEX project_templates_project_id_channel_sort_order_idx
    ON project_templates (project_id, channel, sort_order);

CREATE INDEX project_templates_project_id_sort_order_title_idx
    ON project_templates (project_id, sort_order, title);

-- project_communications
CREATE INDEX project_comms_project_kind_status_date_idx
    ON project_communications (project_id, kind, status, communication_date);

CREATE INDEX project_comms_project_kind_date_updated_idx
    ON project_communications (project_id, kind, communication_date, updated_at);

-- project_pricing_documents
CREATE INDEX project_pricing_docs_project_effective_updated_idx
    ON project_pricing_documents (project_id, effective_from, updated_at);

CREATE INDEX project_pricing_docs_project_status_effective_idx
    ON project_pricing_documents (project_id, status, effective_from);

-- project_matrix_entries
CREATE INDEX project_matrix_entries_project_category_sort_idx
    ON project_matrix_entries (project_id, category, sort_order);

CREATE INDEX project_matrix_entries_project_subcategory_updated_idx
    ON project_matrix_entries (project_id, subcategory, updated_at);

-- audit_log
CREATE INDEX audit_log_occurred_at_idx
    ON audit_log (occurred_at);

CREATE INDEX audit_log_project_id_occurred_at_idx
    ON audit_log (project_id, occurred_at);

CREATE INDEX audit_log_actor_user_id_occurred_at_idx
    ON audit_log (actor_user_id, occurred_at);

CREATE INDEX audit_log_module_key_occurred_at_idx
    ON audit_log (module_key, occurred_at);

CREATE INDEX audit_log_entity_type_entity_id_occurred_at_idx
    ON audit_log (entity_type, entity_id, occurred_at);


-- =============================================================================
-- SECTION 5: FOREIGN KEY CONSTRAINTS
-- =============================================================================

-- project_memberships → projects, users
ALTER TABLE project_memberships
    ADD CONSTRAINT project_memberships_project_id_fkey
        FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE,
    ADD CONSTRAINT project_memberships_user_id_fkey
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE;

-- project_modules → projects
ALTER TABLE project_modules
    ADD CONSTRAINT project_modules_project_id_fkey
        FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE;

-- project_forms → projects
ALTER TABLE project_forms
    ADD CONSTRAINT project_forms_project_id_fkey
        FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE;

-- project_form_submissions → projects, project_forms, users
ALTER TABLE project_form_submissions
    ADD CONSTRAINT project_form_submissions_project_id_fkey
        FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE,
    ADD CONSTRAINT project_form_submissions_form_id_fkey
        FOREIGN KEY (form_id) REFERENCES project_forms (id) ON DELETE CASCADE,
    ADD CONSTRAINT project_form_submissions_submitter_user_id_fkey
        FOREIGN KEY (submitter_user_id) REFERENCES users (id) ON DELETE SET NULL;

-- project_quick_links → projects
ALTER TABLE project_quick_links
    ADD CONSTRAINT project_quick_links_project_id_fkey
        FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE;

-- project_links → projects
ALTER TABLE project_links
    ADD CONSTRAINT project_links_project_id_fkey
        FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE;

-- project_announcements → projects
ALTER TABLE project_announcements
    ADD CONSTRAINT project_announcements_project_id_fkey
        FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE;

-- project_contacts → projects
ALTER TABLE project_contacts
    ADD CONSTRAINT project_contacts_project_id_fkey
        FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE;

-- project_knowledge_categories → projects, self (parent_id)
ALTER TABLE project_knowledge_categories
    ADD CONSTRAINT project_knowledge_categories_project_id_fkey
        FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE,
    ADD CONSTRAINT project_knowledge_categories_parent_id_fkey
        FOREIGN KEY (parent_id) REFERENCES project_knowledge_categories (id) ON DELETE RESTRICT;

-- project_knowledge_articles → projects, project_knowledge_categories
ALTER TABLE project_knowledge_articles
    ADD CONSTRAINT project_knowledge_articles_project_id_fkey
        FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE,
    ADD CONSTRAINT project_knowledge_articles_category_id_fkey
        FOREIGN KEY (category_id) REFERENCES project_knowledge_categories (id) ON DELETE RESTRICT;

-- project_home_spotlights → projects, project_knowledge_articles
ALTER TABLE project_home_spotlights
    ADD CONSTRAINT project_home_spotlights_project_id_fkey
        FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE,
    ADD CONSTRAINT project_home_spotlights_article_id_fkey
        FOREIGN KEY (article_id) REFERENCES project_knowledge_articles (id) ON DELETE CASCADE;

-- project_knowledge_article_sections → project_knowledge_articles
ALTER TABLE project_knowledge_article_sections
    ADD CONSTRAINT project_knowledge_article_sections_article_id_fkey
        FOREIGN KEY (article_id) REFERENCES project_knowledge_articles (id) ON DELETE CASCADE;

-- project_phrases → projects
ALTER TABLE project_phrases
    ADD CONSTRAINT project_phrases_project_id_fkey
        FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE;

-- project_templates → projects
ALTER TABLE project_templates
    ADD CONSTRAINT project_templates_project_id_fkey
        FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE;

-- project_communications → projects
ALTER TABLE project_communications
    ADD CONSTRAINT project_communications_project_id_fkey
        FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE;

-- project_pricing_documents → projects
ALTER TABLE project_pricing_documents
    ADD CONSTRAINT project_pricing_documents_project_id_fkey
        FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE;

-- project_matrix_entries → projects
ALTER TABLE project_matrix_entries
    ADD CONSTRAINT project_matrix_entries_project_id_fkey
        FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE;

-- upload_policies → projects (nullable — platform-level policies have NULL project_id)
ALTER TABLE upload_policies
    ADD CONSTRAINT upload_policies_project_id_fkey
        FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE;

-- audit_log → users, projects  (both nullable with SET NULL on delete)
ALTER TABLE audit_log
    ADD CONSTRAINT audit_log_actor_user_id_fkey
        FOREIGN KEY (actor_user_id) REFERENCES users (id) ON DELETE SET NULL,
    ADD CONSTRAINT audit_log_project_id_fkey
        FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE SET NULL;
