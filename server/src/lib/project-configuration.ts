import { randomUUID } from "node:crypto";
import { GlobalRole, ModuleKey, Prisma, ProjectRole, type PrismaClient } from "@prisma/client";
import { z } from "zod";
import {
  AUDIT_ACTION_TYPES,
  AUDIT_ENTITY_TYPES,
  collectChangedFields,
  recordAuditLogBestEffort,
} from "./audit-log.js";
import type { ApiFieldError } from "./envelope.js";
import type { ResolvedUser } from "./platform-bootstrap.js";

export type ProjectConfigurationModuleShape = {
  moduleKey: ModuleKey;
  enabled: boolean;
  navVisible: boolean;
  navOrder: number;
  settingsJson: unknown;
};

export type ProjectConfigurationHomeSpotlightShape = {
  id: string;
  articleId: string;
  labelOverride: string | null;
  sortOrder: number;
};

export type ProjectConfigurationSourceProject = {
  modules: ProjectConfigurationModuleShape[];
  homeSpotlights: ProjectConfigurationHomeSpotlightShape[];
};

export type ProjectLeadQuestion = {
  id: string;
  text: string;
  sortOrder: number;
  enabled: boolean;
  condition: {
    questionId: string;
    answer: "tak" | "nie";
  } | null;
};

export type ProjectLeadRule = {
  id: string;
  name: string;
  priority: number;
  enabled: boolean;
  conditions: Array<{
    questionId: string;
    answer: "tak" | "nie";
  }>;
  outcome: "allowed" | "not_allowed" | "conditional" | "informational";
  outcomeLabel: string;
  outcomeNote?: string;
  blocksLead: boolean;
  phraseIdTrwala?: string;
  phraseIdJednorazowa?: string;
};

export type ProjectLeadConfig = {
  questions: ProjectLeadQuestion[];
  rules: ProjectLeadRule[];
};

export type ProjectConfigurationModuleItem = {
  enabled: boolean;
  navVisible: boolean;
  navOrder: number | null;
  settings: Record<string, unknown>;
};

export type ProjectHomeSpotlightItem = {
  id: string;
  pageId: string;
  labelOverride?: string;
  sortOrder: number;
};

export type ProjectConfigurationSnapshot = {
  modules: Record<ModuleKey, ProjectConfigurationModuleItem>;
  moduleAvailability: Record<ModuleKey, boolean>;
  navigation: string[];
  rules: {
    matrixCategoryOrder: string[];
    matrixAdvisoryRules: unknown[];
  };
  homeSpotlights: ProjectHomeSpotlightItem[];
  homeSpotlightsManaged: boolean;
  leadConfig: ProjectLeadConfig;
  leadConfigManaged: boolean;
};

type ProjectRef = {
  id: string;
  slug: string;
  code: string;
  name: string;
};

type ProjectConfigurationMutationSuccess = {
  ok: true;
  data: {
    project: ProjectRef;
    configuration: ProjectConfigurationSnapshot;
  };
};

type ProjectConfigurationValidationFailure = {
  ok: false;
  reason: "validation";
  message: string;
  fieldErrors: ApiFieldError[];
};

type ProjectConfigurationMutationFailure =
  | ProjectConfigurationValidationFailure
  | {
      ok: false;
      reason: "not_found" | "locked" | "forbidden";
    };

export type ProjectConfigurationMutationResult =
  | ProjectConfigurationMutationSuccess
  | ProjectConfigurationMutationFailure;

type ProjectConfigurationContextResult =
  | {
      ok: true;
      data: {
        project: {
          id: string;
          slug: string;
          code: string;
          name: string;
          isListed: boolean;
          memberships: Array<{
            effectiveRole: ProjectRole;
          }>;
          modules: ProjectConfigurationModuleShape[];
          homeSpotlights: ProjectConfigurationHomeSpotlightShape[];
        };
        effectiveRole: ProjectRole;
      };
    }
  | {
      ok: false;
      reason: "not_found" | "locked" | "forbidden";
    };

type ProjectConfigurationProjectRecord = {
  id: string;
  slug: string;
  code: string;
  name: string;
  modules: ProjectConfigurationModuleShape[];
  homeSpotlights: ProjectConfigurationHomeSpotlightShape[];
};

type ProjectConfigurationPermission = "manage_project" | "edit_content";
type PrismaDbClient = PrismaClient | Prisma.TransactionClient;

const GENERIC_NAV_MODULE_KEYS = new Set<ModuleKey>([
  ModuleKey.matrix,
  ModuleKey.communications,
  ModuleKey.templates,
  ModuleKey.pricing,
  ModuleKey.phrases,
  ModuleKey.links,
  ModuleKey.forms,
  ModuleKey.contacts,
  ModuleKey.important_topics,
]);

const NAVIGATION_ORDERABLE_MODULE_KEYS = [
  ModuleKey.matrix,
  ModuleKey.communications,
  ModuleKey.templates,
  ModuleKey.pricing,
  ModuleKey.phrases,
  ModuleKey.links,
  ModuleKey.forms,
  ModuleKey.contacts,
  ModuleKey.important_topics,
] as const;

const PROJECT_MODULE_DEFAULTS: Record<ModuleKey, {
  enabled: boolean;
  navVisible: boolean;
  navOrder: number;
  settingsJson: Record<string, unknown>;
}> = {
  [ModuleKey.matrix]: {
    enabled: true,
    navVisible: true,
    navOrder: 10,
    settingsJson: {},
  },
  [ModuleKey.announcements]: {
    enabled: true,
    navVisible: false,
    navOrder: 20,
    settingsJson: {
      surfaces: {
        showTopbarPills: true,
        showHomePills: true,
      },
    },
  },
  [ModuleKey.communications]: {
    enabled: true,
    navVisible: true,
    navOrder: 22,
    settingsJson: {},
  },
  [ModuleKey.templates]: {
    enabled: true,
    navVisible: true,
    navOrder: 25,
    settingsJson: {},
  },
  [ModuleKey.pricing]: {
    enabled: true,
    navVisible: true,
    navOrder: 26,
    settingsJson: {},
  },
  [ModuleKey.phrases]: {
    enabled: true,
    navVisible: true,
    navOrder: 27,
    settingsJson: {},
  },
  [ModuleKey.links]: {
    enabled: true,
    navVisible: true,
    navOrder: 30,
    settingsJson: {},
  },
  [ModuleKey.forms]: {
    enabled: true,
    navVisible: true,
    navOrder: 35,
    settingsJson: {},
  },
  [ModuleKey.contacts]: {
    enabled: true,
    navVisible: true,
    navOrder: 40,
    settingsJson: {},
  },
  [ModuleKey.important_topics]: {
    enabled: true,
    navVisible: true,
    navOrder: 50,
    settingsJson: {},
  },
  [ModuleKey.quick_links]: {
    enabled: true,
    navVisible: false,
    navOrder: 60,
    settingsJson: {},
  },
  [ModuleKey.home_sections]: {
    enabled: true,
    navVisible: false,
    navOrder: 70,
    settingsJson: {
      homepage: {
        showQuickAccess: true,
        showSpotlights: true,
        showQuickLinks: true,
        quickAccessOrder: [
          "matrix",
          "szablony",
          "cenniki",
          "komunikaty",
          "tematOrg",
          "linki",
          "formularze",
          "kontakty",
          "zwroty",
        ],
      },
    },
  },
  [ModuleKey.lead]: {
    enabled: true,
    navVisible: false,
    navOrder: 80,
    settingsJson: {
      widget: {
        enabledInShell: true,
        title: "Kwalifikacja leada",
      },
    },
  },
};

export function getDefaultProjectModuleDefinitions(): ProjectConfigurationModuleShape[] {
  return Object.values(ModuleKey).map((moduleKey) => {
    const defaults = PROJECT_MODULE_DEFAULTS[moduleKey];

    return {
      moduleKey,
      enabled: defaults.enabled,
      navVisible: defaults.navVisible,
      navOrder: defaults.navOrder,
      settingsJson: structuredClone(defaults.settingsJson),
    };
  });
}

const genericModuleSettingsSchema = z.object({
  navigation: z
    .object({
      visible: z.boolean().optional(),
      label: z.string().trim().max(120, "Navigation label must be at most 120 characters.").optional(),
    })
    .optional(),
  homepageCard: z
    .object({
      visible: z.boolean().optional(),
      title: z.string().trim().max(120, "Homepage card title must be at most 120 characters.").optional(),
      description: z
        .string()
        .trim()
        .max(300, "Homepage card description must be at most 300 characters.")
        .optional(),
    })
    .optional(),
});

const announcementsModuleSettingsSchema = z.object({
  surfaces: z
    .object({
      showTopbarPills: z.boolean().optional(),
      showHomePills: z.boolean().optional(),
    })
    .optional(),
});

const quickAccessOrderModuleKeySchema = z.enum([
  "matrix",
  "szablony",
  "cenniki",
  "komunikaty",
  "tematOrg",
  "linki",
  "formularze",
  "kontakty",
  "zwroty",
]);

const homeSectionsModuleSettingsSchema = z.object({
  homepage: z
    .object({
      showQuickAccess: z.boolean().optional(),
      showSpotlights: z.boolean().optional(),
      showQuickLinks: z.boolean().optional(),
      quickAccessOrder: z.array(quickAccessOrderModuleKeySchema).max(32).optional(),
    })
    .optional(),
});

const leadModuleSettingsSchema = z.object({
  widget: z
    .object({
      enabledInShell: z.boolean().optional(),
      title: z.string().trim().max(120, "Lead widget title must be at most 120 characters.").optional(),
    })
    .optional(),
});

const leadAnswerSchema = z.enum(["tak", "nie"]);

const leadQuestionSchema = z.object({
  id: z.string().trim().min(1, "Question id is required.").max(191),
  text: z.string().trim().min(1, "Question text is required.").max(300),
  sortOrder: z.number().int().min(0),
  enabled: z.boolean(),
  condition: z
    .object({
      questionId: z.string().trim().min(1, "Condition question id is required.").max(191),
      answer: leadAnswerSchema,
    })
    .nullable(),
});

const leadRuleSchema = z.object({
  id: z.string().trim().min(1, "Rule id is required.").max(191),
  name: z.string().trim().min(1, "Rule name is required.").max(200),
  priority: z.number().int(),
  enabled: z.boolean(),
  conditions: z.array(
    z.object({
      questionId: z.string().trim().min(1, "Rule condition question id is required.").max(191),
      answer: leadAnswerSchema,
    })
  ),
  outcome: z.enum(["allowed", "not_allowed", "conditional", "informational"]),
  outcomeLabel: z.string().trim().min(1, "Outcome label is required.").max(200),
  outcomeNote: z.string().trim().max(1_000).optional(),
  blocksLead: z.boolean(),
  phraseIdTrwala: z.string().trim().max(191).optional(),
  phraseIdJednorazowa: z.string().trim().max(191).optional(),
});

const leadConfigSchema = z
  .object({
    questions: z.array(leadQuestionSchema),
    rules: z.array(leadRuleSchema),
  })
  .superRefine((value, context) => {
    const questionIds = new Set<string>();

    value.questions.forEach((question, index) => {
      if (questionIds.has(question.id)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["questions", index, "id"],
          message: "Question ids must be unique.",
        });
        return;
      }

      questionIds.add(question.id);

      if (question.condition && !questionIds.has(question.condition.questionId) && !value.questions.some((entry) => entry.id === question.condition?.questionId)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["questions", index, "condition", "questionId"],
          message: "Question condition references an unknown question.",
        });
      }
    });

    value.rules.forEach((rule, ruleIndex) => {
      rule.conditions.forEach((condition, conditionIndex) => {
        if (!value.questions.some((question) => question.id === condition.questionId)) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["rules", ruleIndex, "conditions", conditionIndex, "questionId"],
            message: "Rule condition references an unknown question.",
          });
        }
      });
    });
  });

const updateProjectModuleSchema = z
  .object({
    enabled: z.boolean().optional(),
    settings: z.unknown().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "Provide at least one configuration field to update.",
  });

const updateNavigationSchema = z.object({
  orderedModuleKeys: z.array(z.nativeEnum(ModuleKey)).min(1, "Navigation order is required."),
});

const replaceHomeSpotlightsSchema = z
  .object({
    items: z
      .array(
        z.object({
          id: z.string().trim().min(1).max(191).optional(),
          pageId: z.string().trim().min(1, "Spotlight page id is required.").max(191),
          labelOverride: z.string().trim().max(160, "Spotlight label override must be at most 160 characters.").nullish(),
          sortOrder: z.number().int().optional(),
        })
      )
      .max(10, "At most 10 homepage spotlights are allowed."),
  })
  .superRefine((value, context) => {
    const pageIds = new Set<string>();

    value.items.forEach((item, index) => {
      if (pageIds.has(item.pageId)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["items", index, "pageId"],
          message: "Each spotlight article can only be selected once.",
        });
        return;
      }

      pageIds.add(item.pageId);
    });
  });

const updateProjectMetadataSchema = z
  .object({
    slug: z
      .string()
      .trim()
      .min(2, "Project slug must contain at least 2 characters.")
      .max(80, "Project slug cannot exceed 80 characters.")
      .transform((value) => value.toLowerCase())
      .refine(
        (value) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value),
        "Project slug may contain only lowercase letters, digits, and single dashes between segments."
      ),
    code: z
      .string()
      .trim()
      .min(2, "Project code must contain at least 2 characters.")
      .max(64, "Project code cannot exceed 64 characters.")
      .transform((value) => value.toUpperCase())
      .refine(
        (value) => /^[A-Z0-9][A-Z0-9._-]*$/.test(value),
        "Project code may contain only letters, digits, dots, underscores, and dashes."
      ),
    name: z
      .string()
      .trim()
      .min(2, "Project name must contain at least 2 characters.")
      .max(120, "Project name cannot exceed 120 characters."),
  })
  .strict();

function sanitizeOptionalString(value: string | null | undefined): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function toRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

function toFieldErrors(error: z.ZodError): ApiFieldError[] {
  return error.issues.map((issue) => ({
    field: issue.path.join(".") || "body",
    code: issue.code,
    message: issue.message,
  }));
}

function validationFailure(error: z.ZodError, message: string): ProjectConfigurationValidationFailure {
  return {
    ok: false,
    reason: "validation",
    message,
    fieldErrors: toFieldErrors(error),
  };
}

function canEditProjectContent(role: ProjectRole | null): boolean {
  return role === ProjectRole.project_admin || role === ProjectRole.content_manager;
}

function canManageProject(role: ProjectRole | null): boolean {
  return role === ProjectRole.project_admin;
}

function shouldAllowPermission(role: ProjectRole | null, permission: ProjectConfigurationPermission): boolean {
  if (permission === "manage_project") {
    return canManageProject(role);
  }

  return canEditProjectContent(role);
}

function buildProjectRef(project: { id: string; slug: string; code: string; name: string }): ProjectRef {
  return {
    id: project.id,
    slug: project.slug,
    code: project.code,
    name: project.name,
  };
}

function canManageProjectMetadata(currentUser: ResolvedUser): boolean {
  return currentUser.globalRole === GlobalRole.super_admin;
}

function metadataConflictFailure(field: string, message: string): ProjectConfigurationValidationFailure {
  return {
    ok: false,
    reason: "validation",
    message,
    fieldErrors: [
      {
        field,
        code: "unique",
        message,
      },
    ],
  };
}

function readStringArray(input: unknown): string[] {
  if (!Array.isArray(input)) {
    return [];
  }

  return input
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function sanitizeGenericModuleSettings(input: unknown): Record<string, unknown> {
  const parsed = genericModuleSettingsSchema.parse(input);

  return {
    ...(parsed.navigation
      ? {
          navigation: {
            ...(typeof parsed.navigation.visible === "boolean"
              ? { visible: parsed.navigation.visible }
              : {}),
            ...(sanitizeOptionalString(parsed.navigation.label)
              ? { label: sanitizeOptionalString(parsed.navigation.label) }
              : {}),
          },
        }
      : {}),
    ...(parsed.homepageCard
      ? {
          homepageCard: {
            ...(typeof parsed.homepageCard.visible === "boolean"
              ? { visible: parsed.homepageCard.visible }
              : {}),
            ...(sanitizeOptionalString(parsed.homepageCard.title)
              ? { title: sanitizeOptionalString(parsed.homepageCard.title) }
              : {}),
            ...(sanitizeOptionalString(parsed.homepageCard.description)
              ? { description: sanitizeOptionalString(parsed.homepageCard.description) }
              : {}),
          },
        }
      : {}),
  };
}

function sanitizeAnnouncementsModuleSettings(input: unknown): Record<string, unknown> {
  const parsed = announcementsModuleSettingsSchema.parse(input);

  return {
    ...(parsed.surfaces
      ? {
          surfaces: {
            ...(typeof parsed.surfaces.showTopbarPills === "boolean"
              ? { showTopbarPills: parsed.surfaces.showTopbarPills }
              : {}),
            ...(typeof parsed.surfaces.showHomePills === "boolean"
              ? { showHomePills: parsed.surfaces.showHomePills }
              : {}),
          },
        }
      : {}),
  };
}

function sanitizeHomeSectionsModuleSettings(input: unknown): Record<string, unknown> {
  const parsed = homeSectionsModuleSettingsSchema.parse(input);

  return {
    ...(parsed.homepage
      ? {
          homepage: {
            ...(typeof parsed.homepage.showQuickAccess === "boolean"
              ? { showQuickAccess: parsed.homepage.showQuickAccess }
              : {}),
            ...(typeof parsed.homepage.showSpotlights === "boolean"
              ? { showSpotlights: parsed.homepage.showSpotlights }
              : {}),
            ...(typeof parsed.homepage.showQuickLinks === "boolean"
              ? { showQuickLinks: parsed.homepage.showQuickLinks }
              : {}),
            ...(parsed.homepage.quickAccessOrder
              ? {
                  quickAccessOrder: parsed.homepage.quickAccessOrder.filter(
                    (entry, index, array) => array.indexOf(entry) === index
                  ),
                }
              : {}),
          },
        }
      : {}),
  };
}

function sanitizeLeadModuleSettings(input: unknown): Record<string, unknown> {
  const parsed = leadModuleSettingsSchema.parse(input);

  return {
    ...(parsed.widget
      ? {
          widget: {
            ...(typeof parsed.widget.enabledInShell === "boolean"
              ? { enabledInShell: parsed.widget.enabledInShell }
              : {}),
            ...(sanitizeOptionalString(parsed.widget.title)
              ? { title: sanitizeOptionalString(parsed.widget.title) }
              : {}),
          },
        }
      : {}),
  };
}

function sanitizeModuleSettings(moduleKey: ModuleKey, input: unknown): Record<string, unknown> {
  if (moduleKey === ModuleKey.announcements) {
    return sanitizeAnnouncementsModuleSettings(input);
  }

  if (moduleKey === ModuleKey.home_sections) {
    return sanitizeHomeSectionsModuleSettings(input);
  }

  if (moduleKey === ModuleKey.lead) {
    return sanitizeLeadModuleSettings(input);
  }

  return sanitizeGenericModuleSettings(input);
}

function extractPublicModuleSettings(moduleKey: ModuleKey, input: unknown): Record<string, unknown> {
  const record = toRecord(input);

  if (moduleKey === ModuleKey.announcements) {
    return sanitizeAnnouncementsModuleSettings({ surfaces: record.surfaces });
  }

  if (moduleKey === ModuleKey.home_sections) {
    return sanitizeHomeSectionsModuleSettings({ homepage: record.homepage });
  }

  if (moduleKey === ModuleKey.lead) {
    return sanitizeLeadModuleSettings({ widget: record.widget });
  }

  return sanitizeGenericModuleSettings({
    navigation: record.navigation,
    homepageCard: record.homepageCard,
  });
}

function mergeModuleSettings(
  moduleKey: ModuleKey,
  existingRawSettings: Record<string, unknown>,
  nextPublicSettings: Record<string, unknown>
): Record<string, unknown> {
  const next = {
    ...PROJECT_MODULE_DEFAULTS[moduleKey].settingsJson,
    ...existingRawSettings,
  } satisfies Record<string, unknown>;

  if (moduleKey === ModuleKey.announcements) {
    next.surfaces = {
      ...toRecord(next.surfaces),
      ...toRecord(nextPublicSettings.surfaces),
    };
    return next;
  }

  if (moduleKey === ModuleKey.home_sections) {
    next.homepage = {
      ...toRecord(next.homepage),
      ...toRecord(nextPublicSettings.homepage),
    };
    return next;
  }

  if (moduleKey === ModuleKey.lead) {
    next.widget = {
      ...toRecord(next.widget),
      ...toRecord(nextPublicSettings.widget),
    };
    return next;
  }

  next.navigation = {
    ...toRecord(next.navigation),
    ...toRecord(nextPublicSettings.navigation),
  };
  next.homepageCard = {
    ...toRecord(next.homepageCard),
    ...toRecord(nextPublicSettings.homepageCard),
  };

  return next;
}

function readMatrixRules(modules: Record<ModuleKey, { settingsJson: Record<string, unknown> }>) {
  const rawSettings = modules[ModuleKey.matrix]?.settingsJson ?? {};
  const rawRules = toRecord(rawSettings.rules);

  return {
    matrixCategoryOrder: readStringArray(rawRules.matrixCategoryOrder),
    matrixAdvisoryRules: Array.isArray(rawRules.matrixAdvisoryRules)
      ? rawRules.matrixAdvisoryRules.filter((item) => item && typeof item === "object")
      : [],
  };
}

function readLeadConfig(rawSettings: Record<string, unknown>): { config: ProjectLeadConfig; managed: boolean } {
  if (!Object.prototype.hasOwnProperty.call(rawSettings, "config")) {
    return {
      config: {
        questions: [],
        rules: [],
      },
      managed: false,
    };
  }

  const parsed = leadConfigSchema.safeParse(rawSettings.config);

  if (!parsed.success) {
    return {
      config: {
        questions: [],
        rules: [],
      },
      managed: true,
    };
  }

  return {
    config: parsed.data,
    managed: true,
  };
}

function readHomeSpotlightsManaged(rawSettings: Record<string, unknown>): boolean {
  return rawSettings.spotlightsManaged === true;
}

function createResolvedModuleRecords(modules: ProjectConfigurationModuleShape[]) {
  const resolved = Object.fromEntries(
    Object.values(ModuleKey).map((moduleKey) => {
      const defaults = PROJECT_MODULE_DEFAULTS[moduleKey];

      return [
        moduleKey,
        {
          moduleKey,
          enabled: defaults.enabled,
          navVisible: defaults.navVisible,
          navOrder: defaults.navOrder,
          settingsJson: structuredClone(defaults.settingsJson),
        },
      ];
    })
  ) as Record<ModuleKey, ProjectConfigurationModuleShape>;

  for (const moduleEntry of modules) {
    resolved[moduleEntry.moduleKey] = {
      moduleKey: moduleEntry.moduleKey,
      enabled: moduleEntry.enabled,
      navVisible: moduleEntry.navVisible,
      navOrder: moduleEntry.navOrder,
      settingsJson: toRecord(moduleEntry.settingsJson),
    };
  }

  return resolved;
}

export function createProjectConfigurationSnapshot(
  project: ProjectConfigurationSourceProject
): ProjectConfigurationSnapshot {
  const resolvedModules = createResolvedModuleRecords(project.modules);
  const leadModuleSettings = toRecord(resolvedModules[ModuleKey.lead].settingsJson);
  const homeSectionsModuleSettings = toRecord(resolvedModules[ModuleKey.home_sections].settingsJson);
  const lead = readLeadConfig(leadModuleSettings);

  const modules = Object.fromEntries(
    Object.values(ModuleKey).map((moduleKey) => {
      const moduleEntry = resolvedModules[moduleKey];

      return [
        moduleKey,
        {
          enabled: moduleEntry.enabled,
          navVisible: moduleEntry.navVisible,
          navOrder: moduleEntry.navOrder,
          settings: extractPublicModuleSettings(moduleKey, moduleEntry.settingsJson),
        },
      ];
    })
  ) as Record<ModuleKey, ProjectConfigurationModuleItem>;

  const moduleAvailability = Object.fromEntries(
    Object.values(ModuleKey).map((moduleKey) => [moduleKey, modules[moduleKey].enabled])
  ) as Record<ModuleKey, boolean>;

  const navigation = [
    "home",
    ...Object.values(ModuleKey)
      .filter((moduleKey) => modules[moduleKey].enabled && modules[moduleKey].navVisible)
      .sort((left, right) => {
        const leftOrder = modules[left].navOrder ?? Number.MAX_SAFE_INTEGER;
        const rightOrder = modules[right].navOrder ?? Number.MAX_SAFE_INTEGER;
        return leftOrder - rightOrder || left.localeCompare(right);
      }),
  ];

  return {
    modules,
    moduleAvailability,
    navigation,
    rules: readMatrixRules(
      Object.fromEntries(
        Object.values(ModuleKey).map((moduleKey) => [
          moduleKey,
          { settingsJson: toRecord(resolvedModules[moduleKey].settingsJson) },
        ])
      ) as Record<ModuleKey, { settingsJson: Record<string, unknown> }>
    ),
    homeSpotlights: [...project.homeSpotlights]
      .sort((left, right) => left.sortOrder - right.sortOrder || left.id.localeCompare(right.id))
      .map((item) => ({
        id: item.id,
        pageId: item.articleId,
        ...(sanitizeOptionalString(item.labelOverride) ? { labelOverride: sanitizeOptionalString(item.labelOverride) } : {}),
        sortOrder: item.sortOrder,
      })),
    homeSpotlightsManaged: readHomeSpotlightsManaged(homeSectionsModuleSettings),
    leadConfig: lead.config,
    leadConfigManaged: lead.managed,
  };
}

function serializeModuleForAudit(moduleKey: ModuleKey, moduleEntry: {
  enabled: boolean;
  navVisible: boolean;
  navOrder: number;
  settingsJson: Record<string, unknown>;
}) {
  return {
    enabled: moduleEntry.enabled,
    navVisible: moduleEntry.navVisible,
    navOrder: moduleEntry.navOrder,
    settings: extractPublicModuleSettings(moduleKey, moduleEntry.settingsJson),
  };
}

async function fetchProjectConfigurationProjectById(
  prisma: PrismaDbClient,
  projectId: string
): Promise<ProjectConfigurationProjectRecord | null> {
  return prisma.project.findUnique({
    where: {
      id: projectId,
    },
    select: {
      id: true,
      slug: true,
      code: true,
      name: true,
      modules: {
        orderBy: [{ navOrder: "asc" }, { moduleKey: "asc" }],
        select: {
          moduleKey: true,
          enabled: true,
          navVisible: true,
          navOrder: true,
          settingsJson: true,
        },
      },
      homeSpotlights: {
        orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
        select: {
          id: true,
          articleId: true,
          labelOverride: true,
          sortOrder: true,
        },
      },
    },
  });
}

async function resolveProjectConfigurationContext(
  prisma: PrismaClient,
  currentUser: ResolvedUser,
  projectSlug: string,
  permission: ProjectConfigurationPermission
): Promise<ProjectConfigurationContextResult> {
  const project = await prisma.project.findFirst({
    where: {
      slug: projectSlug,
      isActive: true,
    },
    select: {
      id: true,
      slug: true,
      code: true,
      name: true,
      isListed: true,
      memberships: {
        where: {
          userId: currentUser.id,
        },
        select: {
          effectiveRole: true,
        },
        take: 1,
      },
      modules: {
        orderBy: [{ navOrder: "asc" }, { moduleKey: "asc" }],
        select: {
          moduleKey: true,
          enabled: true,
          navVisible: true,
          navOrder: true,
          settingsJson: true,
        },
      },
      homeSpotlights: {
        orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
        select: {
          id: true,
          articleId: true,
          labelOverride: true,
          sortOrder: true,
        },
      },
    },
  });

  if (!project) {
    return {
      ok: false,
      reason: "not_found",
    };
  }

  const membership = project.memberships[0] ?? null;
  const effectiveRole = membership?.effectiveRole ?? null;
  const hasMembership = effectiveRole !== null;
  const canSeeProject = project.isListed || hasMembership;

  if (!canSeeProject) {
    return {
      ok: false,
      reason: "not_found",
    };
  }

  if (!hasMembership) {
    return {
      ok: false,
      reason: "locked",
    };
  }

  if (!shouldAllowPermission(effectiveRole, permission)) {
    return {
      ok: false,
      reason: "forbidden",
    };
  }

  return {
    ok: true,
    data: {
      project,
      effectiveRole,
    },
  };
}

async function buildMutationSuccess(
  prisma: PrismaClient,
  project: ProjectRef
): Promise<ProjectConfigurationMutationSuccess> {
  const configurationProject = await fetchProjectConfigurationProjectById(prisma, project.id);

  if (!configurationProject) {
    return {
      ok: true,
      data: {
        project,
        configuration: createProjectConfigurationSnapshot({
          modules: [],
          homeSpotlights: [],
        }),
      },
    };
  }

  return {
    ok: true,
    data: {
      project,
      configuration: createProjectConfigurationSnapshot(configurationProject),
    },
  };
}

export async function updateProjectModuleConfiguration(
  prisma: PrismaClient,
  currentUser: ResolvedUser,
  projectSlug: string,
  moduleKeyInput: string,
  input: unknown
): Promise<ProjectConfigurationMutationResult> {
  const moduleKeyParse = z.nativeEnum(ModuleKey).safeParse(moduleKeyInput);

  if (!moduleKeyParse.success) {
    return validationFailure(moduleKeyParse.error, "Invalid project module key.");
  }

  const parsedInput = updateProjectModuleSchema.safeParse(input);

  if (!parsedInput.success) {
    return validationFailure(parsedInput.error, "Project module configuration request is invalid.");
  }

  const moduleKey = moduleKeyParse.data;
  const context = await resolveProjectConfigurationContext(
    prisma,
    currentUser,
    projectSlug,
    "manage_project"
  );

  if (!context.ok) {
    return context;
  }

  let nextPublicSettings: Record<string, unknown> | null = null;

  if (Object.prototype.hasOwnProperty.call(parsedInput.data, "settings")) {
    const settingsParse = (() => {
      try {
        return {
          ok: true as const,
          data: sanitizeModuleSettings(moduleKey, parsedInput.data.settings),
        };
      } catch (error) {
        if (error instanceof z.ZodError) {
          return {
            ok: false as const,
            error,
          };
        }

        throw error;
      }
    })();

    if (!settingsParse.ok) {
      return validationFailure(settingsParse.error, "Project module settings are invalid.");
    }

    nextPublicSettings = settingsParse.data;
  }

  const projectRef = buildProjectRef(context.data.project);
  const existingModule = context.data.project.modules.find((entry) => entry.moduleKey === moduleKey) ?? null;
  const existingSettingsJson = {
    ...PROJECT_MODULE_DEFAULTS[moduleKey].settingsJson,
    ...toRecord(existingModule?.settingsJson),
  } satisfies Record<string, unknown>;
  const nextSettingsJson = nextPublicSettings
    ? mergeModuleSettings(moduleKey, existingSettingsJson, nextPublicSettings)
    : existingSettingsJson;
  const nextEnabled = parsedInput.data.enabled ?? existingModule?.enabled ?? PROJECT_MODULE_DEFAULTS[moduleKey].enabled;
  const nextNavVisible = GENERIC_NAV_MODULE_KEYS.has(moduleKey)
    ? (typeof toRecord(nextPublicSettings?.navigation).visible === "boolean"
        ? (toRecord(nextPublicSettings?.navigation).visible as boolean)
        : existingModule?.navVisible ?? PROJECT_MODULE_DEFAULTS[moduleKey].navVisible)
    : (existingModule?.navVisible ?? PROJECT_MODULE_DEFAULTS[moduleKey].navVisible);
  const nextNavOrder = existingModule?.navOrder ?? PROJECT_MODULE_DEFAULTS[moduleKey].navOrder;

  const beforeAudit = serializeModuleForAudit(moduleKey, {
    enabled: existingModule?.enabled ?? PROJECT_MODULE_DEFAULTS[moduleKey].enabled,
    navVisible: existingModule?.navVisible ?? PROJECT_MODULE_DEFAULTS[moduleKey].navVisible,
    navOrder: existingModule?.navOrder ?? PROJECT_MODULE_DEFAULTS[moduleKey].navOrder,
    settingsJson: existingSettingsJson,
  });

  const updatedModule = await prisma.projectModule.upsert({
    where: {
      projectId_moduleKey: {
        projectId: context.data.project.id,
        moduleKey,
      },
    },
    update: {
      enabled: nextEnabled,
      navVisible: nextNavVisible,
      navOrder: nextNavOrder,
      settingsJson: nextSettingsJson as Prisma.InputJsonValue,
    },
    create: {
      projectId: context.data.project.id,
      moduleKey,
      enabled: nextEnabled,
      navVisible: nextNavVisible,
      navOrder: nextNavOrder,
      settingsJson: nextSettingsJson as Prisma.InputJsonValue,
    },
    select: {
      enabled: true,
      navVisible: true,
      navOrder: true,
      settingsJson: true,
    },
  });

  const afterAudit = serializeModuleForAudit(moduleKey, {
    enabled: updatedModule.enabled,
    navVisible: updatedModule.navVisible,
    navOrder: updatedModule.navOrder,
    settingsJson: toRecord(updatedModule.settingsJson),
  });

  await recordAuditLogBestEffort(prisma, {
    actor: currentUser,
    project: projectRef,
    moduleKey,
    entityType: AUDIT_ENTITY_TYPES.projectModuleConfiguration,
    entityId: moduleKey,
    actionType: AUDIT_ACTION_TYPES.update,
    metadata: {
      changedFields: collectChangedFields(beforeAudit, afterAudit),
      before: beforeAudit as Prisma.InputJsonObject,
      after: afterAudit as Prisma.InputJsonObject,
    },
  });

  return buildMutationSuccess(prisma, projectRef);
}

export async function updateProjectNavigation(
  prisma: PrismaClient,
  currentUser: ResolvedUser,
  projectSlug: string,
  input: unknown
): Promise<ProjectConfigurationMutationResult> {
  const parsedInput = updateNavigationSchema.safeParse(input);

  if (!parsedInput.success) {
    return validationFailure(parsedInput.error, "Project navigation order request is invalid.");
  }

  const orderedKeys = parsedInput.data.orderedModuleKeys;
  const isExactNavigationSet =
    orderedKeys.length === NAVIGATION_ORDERABLE_MODULE_KEYS.length &&
    orderedKeys.every((moduleKey) =>
      NAVIGATION_ORDERABLE_MODULE_KEYS.includes(
        moduleKey as (typeof NAVIGATION_ORDERABLE_MODULE_KEYS)[number]
      )
    ) &&
    new Set(orderedKeys).size === NAVIGATION_ORDERABLE_MODULE_KEYS.length;

  if (!isExactNavigationSet) {
    const customError = new z.ZodError([
      {
        code: z.ZodIssueCode.custom,
        path: ["orderedModuleKeys"],
        message: "Navigation order must contain each navigation-capable backend module exactly once.",
      },
    ]);

    return validationFailure(customError, "Project navigation order request is invalid.");
  }

  const context = await resolveProjectConfigurationContext(
    prisma,
    currentUser,
    projectSlug,
    "manage_project"
  );

  if (!context.ok) {
    return context;
  }

  const projectRef = buildProjectRef(context.data.project);
  const existingModuleMap = new Map(
    context.data.project.modules.map((moduleEntry) => [moduleEntry.moduleKey, moduleEntry])
  );
  const beforeAudit = Object.fromEntries(
    NAVIGATION_ORDERABLE_MODULE_KEYS.map((moduleKey) => [
      moduleKey,
      existingModuleMap.get(moduleKey)?.navOrder ?? PROJECT_MODULE_DEFAULTS[moduleKey].navOrder,
    ])
  ) as Record<string, number>;

  await prisma.$transaction(
    orderedKeys.map((moduleKey, index) => {
      const existing = existingModuleMap.get(moduleKey);
      const settingsJson = {
        ...PROJECT_MODULE_DEFAULTS[moduleKey].settingsJson,
        ...toRecord(existing?.settingsJson),
      } satisfies Record<string, unknown>;

      return prisma.projectModule.upsert({
        where: {
          projectId_moduleKey: {
            projectId: context.data.project.id,
            moduleKey,
          },
        },
        update: {
          enabled: existing?.enabled ?? PROJECT_MODULE_DEFAULTS[moduleKey].enabled,
          navVisible: existing?.navVisible ?? PROJECT_MODULE_DEFAULTS[moduleKey].navVisible,
          navOrder: index,
          settingsJson: settingsJson as Prisma.InputJsonValue,
        },
        create: {
          projectId: context.data.project.id,
          moduleKey,
          enabled: existing?.enabled ?? PROJECT_MODULE_DEFAULTS[moduleKey].enabled,
          navVisible: existing?.navVisible ?? PROJECT_MODULE_DEFAULTS[moduleKey].navVisible,
          navOrder: index,
          settingsJson: settingsJson as Prisma.InputJsonValue,
        },
      });
    })
  );

  const afterAudit = Object.fromEntries(
    orderedKeys.map((moduleKey, index) => [moduleKey, index])
  ) as Record<string, number>;

  await recordAuditLogBestEffort(prisma, {
    actor: currentUser,
    project: projectRef,
    entityType: AUDIT_ENTITY_TYPES.projectModuleConfiguration,
    entityId: "navigation",
    actionType: AUDIT_ACTION_TYPES.update,
    metadata: {
      changedFields: collectChangedFields(beforeAudit, afterAudit),
      before: beforeAudit,
      after: afterAudit,
    },
  });

  return buildMutationSuccess(prisma, projectRef);
}

export async function updateProjectMetadata(
  prisma: PrismaClient,
  currentUser: ResolvedUser,
  projectSlug: string,
  input: unknown
): Promise<ProjectConfigurationMutationResult> {
  const parsedInput = updateProjectMetadataSchema.safeParse(input);

  if (!parsedInput.success) {
    return validationFailure(parsedInput.error, "Project metadata request is invalid.");
  }

  if (!canManageProjectMetadata(currentUser)) {
    return {
      ok: false,
      reason: "forbidden",
    };
  }

  const project = await prisma.project.findFirst({
    where: {
      slug: projectSlug,
      isActive: true,
    },
    select: {
      id: true,
      slug: true,
      code: true,
      name: true,
    },
  });

  if (!project) {
    return {
      ok: false,
      reason: "not_found",
    };
  }

  const beforeAudit = {
    slug: project.slug,
    code: project.code,
    name: project.name,
  };

  let updatedProject: ProjectRef;

  try {
    const persisted = await prisma.project.update({
      where: {
        id: project.id,
      },
      data: {
        slug: parsedInput.data.slug,
        code: parsedInput.data.code,
        name: parsedInput.data.name,
      },
      select: {
        id: true,
        slug: true,
        code: true,
        name: true,
      },
    });

    updatedProject = buildProjectRef(persisted);
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const target = Array.isArray(error.meta?.target)
        ? error.meta.target.join(",")
        : typeof error.meta?.target === "string"
        ? error.meta.target
        : "";

      if (target.includes("slug")) {
        return metadataConflictFailure("slug", "Slug projektu jest już używany przez inny projekt.");
      }

      return metadataConflictFailure("code", "Kod projektu jest już używany przez inny projekt.");
    }

    throw error;
  }

  const afterAudit = {
    slug: updatedProject.slug,
    code: updatedProject.code,
    name: updatedProject.name,
  };

  await recordAuditLogBestEffort(prisma, {
    actor: currentUser,
    project: updatedProject,
    entityType: AUDIT_ENTITY_TYPES.projectSettings,
    entityId: updatedProject.id,
    actionType: AUDIT_ACTION_TYPES.update,
    metadata: {
      changedFields: collectChangedFields(beforeAudit, afterAudit),
      before: beforeAudit,
      after: afterAudit,
    },
  });

  return buildMutationSuccess(prisma, updatedProject);
}

export async function replaceProjectHomeSpotlights(
  prisma: PrismaClient,
  currentUser: ResolvedUser,
  projectSlug: string,
  input: unknown
): Promise<ProjectConfigurationMutationResult> {
  const parsedInput = replaceHomeSpotlightsSchema.safeParse(input);

  if (!parsedInput.success) {
    return validationFailure(parsedInput.error, "Project home spotlights request is invalid.");
  }

  const context = await resolveProjectConfigurationContext(
    prisma,
    currentUser,
    projectSlug,
    "edit_content"
  );

  if (!context.ok) {
    return context;
  }

  const uniquePageIds = [...new Set(parsedInput.data.items.map((item) => item.pageId))];

  if (uniquePageIds.length > 0) {
    const matchingPages = await prisma.projectKnowledgeArticle.findMany({
      where: {
        projectId: context.data.project.id,
        id: {
          in: uniquePageIds,
        },
      },
      select: {
        id: true,
      },
    });

    const foundIds = new Set(matchingPages.map((page) => page.id));
    const missingIds = uniquePageIds.filter((pageId) => !foundIds.has(pageId));

    if (missingIds.length > 0) {
      const customError = new z.ZodError(
        missingIds.map((pageId) => ({
          code: z.ZodIssueCode.custom,
          path: ["items"],
          message: `Spotlight article ${pageId} was not found in this project.`,
        }))
      );

      return validationFailure(customError, "Project home spotlights request is invalid.");
    }
  }

  const projectRef = buildProjectRef(context.data.project);
  const homeSectionsModule = context.data.project.modules.find(
    (moduleEntry) => moduleEntry.moduleKey === ModuleKey.home_sections
  ) ?? null;
  const existingHomeSectionsSettings = {
    ...PROJECT_MODULE_DEFAULTS[ModuleKey.home_sections].settingsJson,
    ...toRecord(homeSectionsModule?.settingsJson),
  } satisfies Record<string, unknown>;
  const nextHomeSectionsSettings = {
    ...existingHomeSectionsSettings,
    spotlightsManaged: true,
  } satisfies Record<string, unknown>;
  const beforeAudit = {
    items: context.data.project.homeSpotlights
      .slice()
      .sort((left, right) => left.sortOrder - right.sortOrder || left.id.localeCompare(right.id))
      .map((item) => ({
        id: item.id,
        pageId: item.articleId,
        labelOverride: item.labelOverride,
        sortOrder: item.sortOrder,
      })),
    managed: readHomeSpotlightsManaged(existingHomeSectionsSettings),
  };

  await prisma.$transaction(async (tx) => {
    await tx.projectHomeSpotlight.deleteMany({
      where: {
        projectId: context.data.project.id,
      },
    });

    if (parsedInput.data.items.length > 0) {
      await tx.projectHomeSpotlight.createMany({
        data: parsedInput.data.items.map((item, index) => ({
          id: item.id ?? randomUUID(),
          projectId: context.data.project.id,
          articleId: item.pageId,
          labelOverride: sanitizeOptionalString(item.labelOverride) ?? null,
          sortOrder: index,
        })),
      });
    }

    await tx.projectModule.upsert({
      where: {
        projectId_moduleKey: {
          projectId: context.data.project.id,
          moduleKey: ModuleKey.home_sections,
        },
      },
      update: {
        enabled: homeSectionsModule?.enabled ?? PROJECT_MODULE_DEFAULTS[ModuleKey.home_sections].enabled,
        navVisible: homeSectionsModule?.navVisible ?? PROJECT_MODULE_DEFAULTS[ModuleKey.home_sections].navVisible,
        navOrder: homeSectionsModule?.navOrder ?? PROJECT_MODULE_DEFAULTS[ModuleKey.home_sections].navOrder,
        settingsJson: nextHomeSectionsSettings as Prisma.InputJsonValue,
      },
      create: {
        projectId: context.data.project.id,
        moduleKey: ModuleKey.home_sections,
        enabled: homeSectionsModule?.enabled ?? PROJECT_MODULE_DEFAULTS[ModuleKey.home_sections].enabled,
        navVisible: homeSectionsModule?.navVisible ?? PROJECT_MODULE_DEFAULTS[ModuleKey.home_sections].navVisible,
        navOrder: homeSectionsModule?.navOrder ?? PROJECT_MODULE_DEFAULTS[ModuleKey.home_sections].navOrder,
        settingsJson: nextHomeSectionsSettings as Prisma.InputJsonValue,
      },
    });
  });

  const afterAudit = {
    items: parsedInput.data.items.map((item, index) => ({
      id: item.id ?? null,
      pageId: item.pageId,
      labelOverride: sanitizeOptionalString(item.labelOverride) ?? null,
      sortOrder: index,
    })),
    managed: true,
  };

  await recordAuditLogBestEffort(prisma, {
    actor: currentUser,
    project: projectRef,
    moduleKey: ModuleKey.home_sections,
    entityType: AUDIT_ENTITY_TYPES.projectHomeSpotlight,
    entityId: "home-spotlights",
    actionType: AUDIT_ACTION_TYPES.update,
    metadata: {
      changedFields: collectChangedFields(beforeAudit, afterAudit),
      before: beforeAudit,
      after: afterAudit,
    },
  });

  return buildMutationSuccess(prisma, projectRef);
}

export async function replaceProjectLeadConfig(
  prisma: PrismaClient,
  currentUser: ResolvedUser,
  projectSlug: string,
  input: unknown
): Promise<ProjectConfigurationMutationResult> {
  const parsedInput = leadConfigSchema.safeParse(input);

  if (!parsedInput.success) {
    return validationFailure(parsedInput.error, "Project lead configuration request is invalid.");
  }

  const context = await resolveProjectConfigurationContext(
    prisma,
    currentUser,
    projectSlug,
    "edit_content"
  );

  if (!context.ok) {
    return context;
  }

  const phraseIds = [
    ...new Set(
      parsedInput.data.rules.flatMap((rule) => [rule.phraseIdTrwala, rule.phraseIdJednorazowa].filter(Boolean) as string[])
    ),
  ];

  if (phraseIds.length > 0) {
    const matchingPhrases = await prisma.projectPhrase.findMany({
      where: {
        projectId: context.data.project.id,
        id: {
          in: phraseIds,
        },
      },
      select: {
        id: true,
      },
    });

    const foundIds = new Set(matchingPhrases.map((phrase) => phrase.id));
    const missingPhraseIds = phraseIds.filter((phraseId) => !foundIds.has(phraseId));

    if (missingPhraseIds.length > 0) {
      const customError = new z.ZodError(
        missingPhraseIds.map((phraseId) => ({
          code: z.ZodIssueCode.custom,
          path: ["rules"],
          message: `Lead rule phrase ${phraseId} was not found in this project.`,
        }))
      );

      return validationFailure(customError, "Project lead configuration request is invalid.");
    }
  }

  const projectRef = buildProjectRef(context.data.project);
  const leadModule = context.data.project.modules.find((moduleEntry) => moduleEntry.moduleKey === ModuleKey.lead) ?? null;
  const existingLeadSettings = {
    ...PROJECT_MODULE_DEFAULTS[ModuleKey.lead].settingsJson,
    ...toRecord(leadModule?.settingsJson),
  } satisfies Record<string, unknown>;
  const previousLead = readLeadConfig(existingLeadSettings);
  const nextLeadSettings = {
    ...existingLeadSettings,
    config: parsedInput.data,
  } satisfies Record<string, unknown>;

  await prisma.projectModule.upsert({
    where: {
      projectId_moduleKey: {
        projectId: context.data.project.id,
        moduleKey: ModuleKey.lead,
      },
    },
    update: {
      enabled: leadModule?.enabled ?? PROJECT_MODULE_DEFAULTS[ModuleKey.lead].enabled,
      navVisible: leadModule?.navVisible ?? PROJECT_MODULE_DEFAULTS[ModuleKey.lead].navVisible,
      navOrder: leadModule?.navOrder ?? PROJECT_MODULE_DEFAULTS[ModuleKey.lead].navOrder,
      settingsJson: nextLeadSettings as Prisma.InputJsonValue,
    },
    create: {
      projectId: context.data.project.id,
      moduleKey: ModuleKey.lead,
      enabled: leadModule?.enabled ?? PROJECT_MODULE_DEFAULTS[ModuleKey.lead].enabled,
      navVisible: leadModule?.navVisible ?? PROJECT_MODULE_DEFAULTS[ModuleKey.lead].navVisible,
      navOrder: leadModule?.navOrder ?? PROJECT_MODULE_DEFAULTS[ModuleKey.lead].navOrder,
      settingsJson: nextLeadSettings as Prisma.InputJsonValue,
    },
  });

  await recordAuditLogBestEffort(prisma, {
    actor: currentUser,
    project: projectRef,
    moduleKey: ModuleKey.lead,
    entityType: AUDIT_ENTITY_TYPES.projectModuleConfiguration,
    entityId: ModuleKey.lead,
    actionType: AUDIT_ACTION_TYPES.update,
    metadata: {
      changedFields: collectChangedFields(
        {
          leadConfig: previousLead.config,
          managed: previousLead.managed,
        },
        {
          leadConfig: parsedInput.data,
          managed: true,
        }
      ),
      before: {
        leadConfig: previousLead.config,
        managed: previousLead.managed,
      },
      after: {
        leadConfig: parsedInput.data,
        managed: true,
      },
    },
  });

  return buildMutationSuccess(prisma, projectRef);
}