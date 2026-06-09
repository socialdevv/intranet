# Local Private Import Tooling

This folder is the predictable home for local-only import scripts that read real legacy project data from the local workspace and write into the development database.

What this is for:
- keeping `prisma/seed.ts` safe, generic, and committed
- allowing local migration work against the real legacy JSON shape without checking private data or private local import scripts into git
- incrementally importing only the backend-backed slices that already exist

What is intentionally excluded from git:
- executable local import scripts such as `scripts/local-private/*.local.ts`
- any private transformed data or generated fixtures derived from `public/altcloud-data.json`

Current local-only script path:
- `scripts/local-private/import-legacy-quick-links.local.ts`
- `scripts/local-private/import-legacy-links.local.ts`
- `scripts/local-private/import-legacy-announcements.local.ts`
- `scripts/local-private/import-legacy-communications.local.ts`
- `scripts/local-private/import-legacy-contacts.local.ts`
- `scripts/local-private/import-legacy-important-topics.local.ts`
- `scripts/local-private/import-legacy-knowledge.local.ts`
- `scripts/local-private/import-legacy-matrix.local.ts`
- `scripts/local-private/import-legacy-templates.local.ts`
- `scripts/local-private/import-legacy-pricing.local.ts`
- `scripts/local-private/import-legacy-phrases.local.ts`
- `scripts/local-private/import-legacy-lead.local.ts`

Current supported slice:
- project identification / mapping from the legacy JSON metadata
- homepage quick-links import into `project_quick_links`
- links import into `project_links`
- banner/navbar/home announcements import into `project_announcements`
- communications import into `project_communications`
- contacts import into `project_contacts`
- important topics import into `project_communications` with the `organizational_topic` content kind
- knowledge categories/pages import into `project_knowledge_categories`, `project_knowledge_articles`, and `project_knowledge_article_sections`
- matrix entries import into `project_matrix_entries` plus matrix rules in `project_modules.settings_jsonb`
- templates import into `project_templates`
- pricing documents import into `project_pricing_documents`
- approved responses import into `project_phrases`
- lead qualification questions and rules import into `project_modules.lead.settings_jsonb.config`

How to use it locally:
1. Start from the tracked example file in this folder.
2. Copy it to `scripts/local-private/import-legacy-quick-links.local.ts`.
3. Run a dry run first:
   `tsx scripts/local-private/import-legacy-quick-links.local.ts`
4. Apply the import only when the summary looks correct:
   `tsx scripts/local-private/import-legacy-quick-links.local.ts --apply`

For project links:
1. Start from the tracked example file in this folder.
2. Copy it to `scripts/local-private/import-legacy-links.local.ts`.
3. Run a dry run first:
   `tsx scripts/local-private/import-legacy-links.local.ts`
4. Apply the import only when the summary looks correct:
   `tsx scripts/local-private/import-legacy-links.local.ts --apply`

For announcements:
1. Start from the tracked example file in this folder.
2. Copy it to `scripts/local-private/import-legacy-announcements.local.ts`.
3. Run a dry run first:
   `tsx scripts/local-private/import-legacy-announcements.local.ts`
4. Apply the import only when the summary looks correct:
   `tsx scripts/local-private/import-legacy-announcements.local.ts --apply`

For communications:
1. Start from the tracked example file in this folder.
2. Copy it to `scripts/local-private/import-legacy-communications.local.ts`.
3. Run a dry run first:
   `tsx scripts/local-private/import-legacy-communications.local.ts`
4. Apply the import only when the summary looks correct:
   `tsx scripts/local-private/import-legacy-communications.local.ts --apply`

For contacts:
1. Start from the tracked example file in this folder.
2. Copy it to `scripts/local-private/import-legacy-contacts.local.ts`.
3. Run a dry run first:
   `tsx scripts/local-private/import-legacy-contacts.local.ts`
4. Apply the import only when the summary looks correct:
   `tsx scripts/local-private/import-legacy-contacts.local.ts --apply`

For important topics:
1. Start from the tracked example file in this folder.
2. Copy it to `scripts/local-private/import-legacy-important-topics.local.ts`.
3. Run a dry run first:
   `tsx scripts/local-private/import-legacy-important-topics.local.ts`
4. Apply the import only when the summary looks correct:
   `tsx scripts/local-private/import-legacy-important-topics.local.ts --apply`

For knowledge categories and articles:
1. Start from the tracked example file in this folder.
2. Copy it to `scripts/local-private/import-legacy-knowledge.local.ts`.
3. Run a dry run first:
   `tsx scripts/local-private/import-legacy-knowledge.local.ts`
4. Apply the import only when the summary looks correct:
   `tsx scripts/local-private/import-legacy-knowledge.local.ts --apply`
   This importer preserves legacy category, article, and section ids plus category `childOrder` and section ordering so internal knowledge links stay stable.

For matrix:
1. Start from the tracked example file in this folder.
2. Copy it to `scripts/local-private/import-legacy-matrix.local.ts`.
3. Run a dry run first:
   `tsx scripts/local-private/import-legacy-matrix.local.ts`
4. Apply the import only when the summary looks correct:
   `tsx scripts/local-private/import-legacy-matrix.local.ts --apply`

For templates:
1. Start from the tracked example file in this folder.
2. Copy it to `scripts/local-private/import-legacy-templates.local.ts`.
3. Run a dry run first:
   `tsx scripts/local-private/import-legacy-templates.local.ts`
4. Apply the import only when the summary looks correct:
   `tsx scripts/local-private/import-legacy-templates.local.ts --apply`

For pricing:
1. Start from the tracked example file in this folder.
2. Copy it to `scripts/local-private/import-legacy-pricing.local.ts`.
3. Run a dry run first:
   `tsx scripts/local-private/import-legacy-pricing.local.ts`
4. Apply the import only when the summary looks correct:
   `tsx scripts/local-private/import-legacy-pricing.local.ts --apply`

For approved responses:
1. Start from the tracked example file in this folder.
2. Copy it to `scripts/local-private/import-legacy-phrases.local.ts`.
3. Run a dry run first:
   `tsx scripts/local-private/import-legacy-phrases.local.ts`
4. Apply the import only when the summary looks correct:
   `tsx scripts/local-private/import-legacy-phrases.local.ts --apply`

For lead qualification:
1. Start from the tracked example file in this folder.
2. Copy it to `scripts/local-private/import-legacy-lead.local.ts`.
3. Run a dry run first:
   `tsx scripts/local-private/import-legacy-lead.local.ts`
4. Apply the import only when the summary looks correct:
   `tsx scripts/local-private/import-legacy-lead.local.ts --apply`
   Import phrases first if the lead rules reference `phraseIdTrwala` or `phraseIdJednorazowa`.

Safety notes:
- The local importer reads the existing local `public/altcloud-data.json` file directly.
- Do not copy private JSON into tracked fixtures or seed scripts.
- Keep committed sample data in `prisma/seed.ts` generic and sanitized.