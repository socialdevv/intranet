// Domain types for AltCloud static app.
// Adapted from the reference repo (socialdevv-altcloud/lib/types/domain.ts).
// PersonalNote and UserNotification (per-user DB) have been removed.

import type { LeadConfig } from "@/lib/types/lead";
export type { LeadConfig } from "@/lib/types/lead";

export type KnowledgeCategory = string;

export type InlineSegment =
  | { type: "text"; text: string }
  | { type: "internal_link"; pageId: string; label: string }
  | { type: "matrix_link"; matrixId: string; label: string };

export type RichText = InlineSegment[];

export type ParagraphBlock = { type: "paragraph"; content: RichText };
export type ListBlock = { type: "list"; items: RichText[] };
export type TableBlock = { type: "table"; headers: string[]; rows: string[][] };
export type DocBlock = ParagraphBlock | ListBlock | TableBlock;

export type DocSection = {
  id: string;
  title: string;
  /** When true, the section is rendered collapsed by default in the article view. */
  collapsible?: boolean;
  /** When false, the thin separator line before this section is hidden. Defaults to true. */
  showSeparator?: boolean;
  blocks?: DocBlock[];
  tags?: string[];
  jsonContent?: unknown;
};

export type KnowledgePage = {
  id: string;
  /** Slug of the category this page belongs to. */
  category: KnowledgeCategory;
  categoryDisplayName?: string;
  /** ID of the KnowledgeCategoryEntry this page belongs to. */
  categoryId: string;
  slug: string;
  title: string;
  summary: string;
  author?: string;
  updatedAt: string;
  tags: string[];
  hiddenTags?: string[];
  matrixLinkId?: string | null;
  globalMatrixLinkIds?: string[];
  keyDataPoints?: Array<{ label: string; value: string }>;
  quickActions?: string[];
  sections: DocSection[];
  sortOrder?: number;
  /** Optional URL to the corresponding article in the main/full knowledge base.
   *  When set, an external-link icon is shown near the article title. */
  externalSourceUrl?: string;
  /** When true, a local section-title search bar is shown on the article page,
   *  letting users quickly navigate to a section by its heading. */
  sectionSearch?: boolean;
};

export type RoutingRule = {
  clientType: string;
  routes: Record<string, string>;
};

export type MatrixCriterion = {
  field: string;
  value: string;
};

export type MatrixCondition = {
  department: string;
  criteria: MatrixCriterion[];
};

export type MatrixAdvisorySeverity = "info" | "warning" | "critical";

export type MatrixAdvisoryRule = {
  id: string;
  title: string;
  message: string;
  severity?: MatrixAdvisorySeverity;
  match: {
    criterionValueIncludesAny: string[];
    criterionFieldIn?: string[];
  };
};

export type MatrixDecision = {
  id: string;
  category: string;
  subcategory: string;
  keywords: string[];
  description: string;
  slaDays: number;
  instructions: string;
  additionalNotes: string;
  defaultDepartment: string;
  conditions: MatrixCondition[];
  linkedTemplateIds: string[];
  sortOrder?: number;
};

// Compatibility alias.
export type MatrixProcedure = MatrixDecision;

export type SearchResult = {
  id: string;
  type: "page" | "section" | "matrix";
  title: string;
  description: string;
  href: string;
  score: number;
};

export type TemplateChannel = "email" | "zgloszenie";

export type TextTemplate = {
  id: string;
  title: string;
  channel: TemplateChannel;
  /** Main reusable template text — TipTap JSON doc. */
  body: unknown;
  /** Example of a correctly filled-in version — TipTap JSON doc. */
  example: unknown;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type KomunikatStatus = "active" | "archived";

export type CommunicationMessage = {
  id: string;
  title: string;
  /** TipTap JSON doc — rich text body. */
  body: unknown;
  status: KomunikatStatus;
  /** Explicit publication/communication date chosen by the admin (ISO date string, e.g. "2026-04-20"). */
  communicationDate?: string;
  createdAt: string;
  updatedAt: string;
};

// ── Cenniki (pricing documents) ───────────────────────────────────────────────
//
// Two content types are supported inside a cennik document:
//
//  1. CennikTableSection  — classic pricing table with named columns + rows
//  2. CennikChargesSection — distribution-charge list where each charge has
//                            simple key→value variants (tariff, phase, range…)
//
// A Cennik contains sections: Array<CennikTableSection | CennikChargesSection>

// ── 1. Standard table section ─────────────────────────────────────────────────

/** A column in a standard pricing table. */
export type CennikColumn = {
  key: string;
  label: string;
};

/** A data row in a standard pricing table. */
export type CennikRow = {
  id: string;
  /** Charge/row label. */
  label: string;
  /** Optional technical symbol, e.g. "c_zm". */
  symbol?: string;
  /** Per-row unit override. Omit to use the section default. */
  unit?: string;
  /** Value per column key. */
  values: Record<string, string>;
};

/** A standard pricing table section. */
export type CennikTableSection = {
  type: "table";
  id: string;
  title: string;
  description?: string;
  /** Default unit displayed in the table header, e.g. "zł/kWh". */
  unit: string;
  columns: CennikColumn[];
  rows: CennikRow[];
  footnotes?: string[];
};

// ── 2. Distribution-charge section ───────────────────────────────────────────

/**
 * A single variant line for a distribution charge.
 * `conditions` is a human-readable description of when this value applies,
 * e.g. "G11 + 1-fazowy" or "G12, powyżej 1 200 kWh/rok".
 */
export type CennikChargeVariant = {
  id: string;
  conditions: string;
  value: string;
};

/** A single named distribution charge with one or more conditional variants. */
export type CennikChargeItem = {
  id: string;
  /** Name of the charge, e.g. "Opłata stała sieciowa". */
  name: string;
  /** Unit for this charge, e.g. "zł/miesiąc". */
  unit: string;
  variants: CennikChargeVariant[];
};

/** A distribution-charges section — a list of charge items with variants. */
export type CennikChargesSection = {
  type: "charges";
  id: string;
  title: string;
  description?: string;
  items: CennikChargeItem[];
  footnotes?: string[];
};

// ── Cennik document ───────────────────────────────────────────────────────────

export type CennikSection = CennikTableSection | CennikChargesSection;

/** A pricing document — contains one or more sections of either type. */
export type Cennik = {
  id: string;
  title: string;
  subtitle?: string;
  /** Issuing organization, e.g. "Tauron Dystrybucja S.A." */
  provider?: string;
  /** Date from which pricing is effective (YYYY-MM-DD). */
  effectiveFrom: string;
  updatedAt: string;
  status: "active" | "archived";
  /** Document-level footnotes. */
  footnotes?: string[];
  sections: CennikSection[];
};

export type CennikiPayload = {
  documents: Cennik[];
};

// ── Category tree node (used by sidebar / category context) ──────────────────

export type KnowledgeCategoryEntry = {
  id: string;
  slug: string;
  name: string;
  description?: string;
  parentId: string | null;
  sortOrder: number;
  /** Unified display order of direct children: ordered mix of article IDs and subcategory IDs.
   *  When set, the sidebar renders in this interleaved order instead of grouping by type. */
  childOrder?: string[];
};

export type CategoryNode = {
  id: string;
  slug: string;
  name: string;
  parentId: string | null;
  /** Propagated from KnowledgeCategoryEntry.childOrder — unified display order of direct children. */
  childOrder?: string[];
  articles: Array<{
    id: string;
    slug: string;
    title: string;
    categorySlug: string;
  }>;
  children: CategoryNode[];
};

// ── Auth ─────────────────────────────────────────────────────────────────────

export type AppRole = "admin" | "editor" | "agent";

export type AppIdentitySource = IdentitySourceMode | "platform-bootstrap" | "local-fallback";

export type AppUser = {
  role: AppRole;
  displayName: string;
  initials: string;
  /** Auth source used to establish the current session. */
  identitySource?: AppIdentitySource;
  /** Optional stable principal identifier from external identity systems. */
  principalId?: string;
  /** Optional email/UPN from external identity systems. */
  email?: string;
};

// ── Project configuration / system settings ─────────────────────────────────

export type AppModuleKey =
  | "matrix"
  | "szablony"
  | "cenniki"
  | "komunikaty"
  | "tematOrg"
  | "linki"
  | "formularze"
  | "kontakty"
  | "zwroty"
  | "homeSections"
  | "lead"
  | "announcements";

export type AppModuleToggleMap = Partial<Record<AppModuleKey, boolean>>;

export type ModuleNavigationSettings = {
  /** Controls whether the module should appear in the main navigation. */
  visible?: boolean;
  /** Optional navigation label override for this deployment. */
  label?: string;
};

export type ModuleHomepageCardSettings = {
  /** Controls whether the module appears in homepage quick access cards. */
  visible?: boolean;
  /** Optional homepage card title override. */
  title?: string;
  /** Optional homepage card description override. */
  description?: string;
};

export type GenericModuleSettings = {
  navigation?: ModuleNavigationSettings;
  homepageCard?: ModuleHomepageCardSettings;
};

export type HomeSectionsModuleSettings = {
  homepage?: {
    showQuickAccess?: boolean;
    showSpotlights?: boolean;
    showQuickLinks?: boolean;
    /** Preferred display order for quick-access tile configuration (sidebar modules). */
    quickAccessOrder?: AppModuleKey[];
  };
};

export type LeadModuleSettings = {
  widget?: {
    enabledInShell?: boolean;
    title?: string;
  };
};

export type AnnouncementsModuleSettings = {
  surfaces?: {
    showTopbarPills?: boolean;
    showHomePills?: boolean;
  };
};

export type AppModuleSettingsMap = {
  matrix?: GenericModuleSettings;
  szablony?: GenericModuleSettings;
  cenniki?: GenericModuleSettings;
  komunikaty?: GenericModuleSettings;
  tematOrg?: GenericModuleSettings;
  linki?: GenericModuleSettings;
  formularze?: GenericModuleSettings;
  kontakty?: GenericModuleSettings;
  zwroty?: GenericModuleSettings;
  homeSections?: HomeSectionsModuleSettings;
  lead?: LeadModuleSettings;
  announcements?: AnnouncementsModuleSettings;
};

export type FormFieldType = "text" | "textarea" | "select" | "checkbox";

export type FormFieldOption = {
  value: string;
  label: string;
};

export type ProjectFormField = {
  id: string;
  label: string;
  type: FormFieldType;
  required: boolean;
  placeholder?: string;
  options?: FormFieldOption[];
};

export type ProjectFormDefinition = {
  id: string;
  slug: string;
  title: string;
  description: string;
  isActive: boolean;
  sortOrder: number;
  fields: ProjectFormField[];
  createdAt: string;
  updatedAt: string;
};

export type ProjectFormSubmission = {
  id: string;
  formId: string;
  formSlug: string;
  formTitle: string;
  payload: unknown;
  submitter: {
    userId: string | null;
    email: string | null;
    firstName: string | null;
    lastName: string | null;
    displayName: string | null;
  };
  deliveryStatus: string;
  deliveryNote: string | null;
  createdAt: string;
};

export type AppConfiguration = {
  modules?: {
    /** Feature toggles for optional modules (deployment-specific). */
    enabled?: AppModuleToggleMap;
    /** Per-module deployment settings. */
    settings?: AppModuleSettingsMap;
  };
  navigation?: {
    /** Ordered list of main navigation route keys (e.g. home, matrix, szablony). */
    mainNavOrder?: string[];
  };
  rules?: {
    /** Ordered list of matrix category names. */
    matrixCategoryOrder?: string[];
    /** Configurable advisory rules rendered alongside matching matrix entries. */
    matrixAdvisoryRules?: MatrixAdvisoryRule[];
  };
};

export type IdentitySourceMode = "pin" | "external-header" | "external-whoami";
export type SystemStorageMode = "file-local" | "api-assisted";

export type AppSystemSettings = {
  auth?: {
    /** Current mode remains PIN; external modes are planned for future integration. */
    identitySource?: IdentitySourceMode;
    externalIdentityHeader?: string;
    whoamiEndpoint?: string;
    /** Future role model that deployments can prepare now. */
    plannedRoles?: AppRole[];
  };
  deployment?: {
    projectCode?: string;
    projectDisplayName?: string;
  };
  integration?: {
    /** Runtime data-access mode for this deployment. */
    storageMode?: SystemStorageMode;
    /** Base URL for optional API-assisted mode, e.g. https://project.example.com/api. */
    apiBaseUrl?: string;
    /** Optional endpoint path for JSON data save/load. Defaults to /app-data. */
    dataEndpointPath?: string;
    /** Optional endpoint path for file/image uploads. Defaults to /api/v1/uploads. */
    uploadEndpointPath?: string;
  };
};

// ── Linki (quick-links module) ────────────────────────────────────────────────

/**
 * A single quick-link entry.
 * `icon` accepts a lucide-react icon name (e.g. "Globe"), an emoji (e.g. "🔗"),
 * or any short string — the UI renders whichever makes sense.
 */
export type LinkItem = {
  id: string;
  title: string;
  url: string;
  description: string;
  /** Lucide icon name, emoji, or short label used as icon. */
  icon: string;
  sortOrder: number;
  /** When true the link opens in a new tab. Defaults to true. */
  openInNewTab: boolean;
  /** When true, `url` is treated as an internal app route (no new tab). */
  isInternal: boolean;
};

// ── Homepage curated sections ─────────────────────────────────────────────────

/**
 * A single admin-curated article spotlight shown in the "Ważne tematy" section
 * on the homepage. Points to a KnowledgePage by id.
 */
export type HomeSpotlight = {
  id: string;
  /** ID of the target KnowledgePage. */
  pageId: string;
  /** Optional label override. Falls back to the page title when absent. */
  labelOverride?: string;
  sortOrder: number;
};

/**
 * A single admin-curated quick link shown in the "Szybkie linki" section on
 * the homepage. Supports the same icon system as LinkItem.
 */
export type HomeQuickLink = {
  id: string;
  label: string;
  url: string;
  /** Lucide icon value (from PRESET_ICONS), emoji, or short string. */
  icon: string;
  sortOrder: number;
  /** When true the link opens in a new tab. */
  openInNewTab?: boolean;
  /** When true, `url` is treated as an internal app route (no new tab). */
  isInternal?: boolean;
};

// ── Contact entries ──────────────────────────────────────────────────────────

export type ContactGroup = "wewnetrzne" | "zewnetrzne";

/**
 * A single group within a section: multiple items (e.g. cities/regions) that
 * all share one common action/result/phone.
 */
export type ContactDetailGroup = {
  id: string;
  /** Multi-line text — one item per line, e.g. "Inowrocław\nChojnice\nNakło nad Notecią". */
  items: string;
  /** The shared action/result for all items in this group. */
  action: string;
};

export type ContactTableSection = {
  id: string;
  label: string;
  groups: ContactDetailGroup[];
};

export type ContactDetailTable = {
  title?: string;
  /** Header for the left "section" column. Default "Sekcja". */
  sectionHeader?: string;
  /** Header for the middle "items/regions" column. Default "Pozycja". */
  itemsHeader?: string;
  /** Header for the right "action/result" column. Default "Działanie". */
  actionHeader?: string;
  sections: ContactTableSection[];
  notes?: string;
};

export type ContactEntry = {
  id: string;
  title: string;
  description: string;
  phone?: string;
  email?: string;
  address?: string;
  detailTable?: ContactDetailTable;
  group: ContactGroup;
  sortOrder: number;
};

// ── Tematy organizacyjne ──────────────────────────────────────────────────────

export type OrgEntryStatus = "active" | "archived";

/**
 * A single organizational topic entry — used for internal organizational
 * matters such as role changes, team updates, responsibility adjustments,
 * and internal work-organization notes.
 */
export type OrgEntry = {
  id: string;
  title: string;
  /** TipTap JSON doc — rich text body. */
  body: unknown;
  status: OrgEntryStatus;
  /** Explicit date chosen by the admin for this entry (ISO date string, e.g. "2026-04-24"). */
  entryDate?: string;
  createdAt: string;
  updatedAt: string;
};

// ── Gotowe zwroty (ready-to-use phrases) ─────────────────────────────────────

export type PhraseEntry = {
  id: string;
  title: string;
  content: string;
  /** When true, show a prominent warning that the customer must confirm explicitly. */
  requiresConfirmation?: boolean;
  sortOrder: number;
};

// ── Global navbar announcements ─────────────────────────────────────────────

export type AnnouncementColor = "red" | "orange" | "green" | "blue";

export type Announcement = {
  id: string;
  title: string;
  /** TipTap JSON doc for detailed announcement content. */
  body?: unknown;
  /** Legacy/plain fallback text used by older exports and simple previews. */
  description: string;
  color: AnnouncementColor;
  active: boolean;
  /** Optional UTC ISO date-time when announcement becomes visible. */
  visibleFrom?: string;
  /** Optional UTC ISO date-time when announcement stops being visible. */
  visibleUntil?: string;
  createdAt: string;
  updatedAt: string;
};

// ── Root data model (altcloud-data.json) ─────────────────────────────────────

export type AppData = {
  meta: {
    schemaVersion: number;
    exportedAt: string;
    appName: string;
  };
  auth: {
    consultantPinHash?: string;
    adminPinHash: string;
  };
  categories: KnowledgeCategoryEntry[];
  pages: KnowledgePage[];
  matrix: MatrixDecision[];
  /** Legacy field kept for backwards compatibility with older exports.
   *  New data should use configuration.rules.matrixCategoryOrder. */
  matrixCategoryOrder?: string[];
  templates: TextTemplate[];
  communications: CommunicationMessage[];
  cenniki: CennikiPayload;
  links: LinkItem[];
  /** Admin-curated important article shortcuts shown on the homepage. */
  homeSpotlights?: HomeSpotlight[];
  /** Admin-curated quick links shown on the homepage. */
  homeQuickLinks?: HomeQuickLink[];
  /** Admin-curated contact entries grouped by internal / external. */
  contacts?: ContactEntry[];
  /** Admin-curated ready-to-use phrases for consultants. */
  phrases?: PhraseEntry[];
  /** Admin-curated organizational topic entries. */
  orgEntries?: OrgEntry[];
  /** Legacy field kept for backwards compatibility with older exports.
   *  New data should use configuration.navigation.mainNavOrder. */
  navOrder?: string[];
  /** Global navbar announcements/alerts managed by admins. */
  announcements?: Announcement[];
  /** Configurable lead-qualification widget — questions, rules, outcomes. */
  leadConfig?: LeadConfig;
  /** Deployment-specific configuration split from content payload. */
  configuration?: AppConfiguration;
  /** Technical/system metadata and future auth integration settings. */
  system?: AppSystemSettings;
};
