import { createContext, useCallback, useContext, useMemo } from "react";
import type {
  AppData,
  AppConfiguration,
  AppModuleKey,
  AppModuleSettingsMap,
  AppSystemSettings,
  CategoryNode,
  KnowledgeCategoryEntry,
  KnowledgePage,
  MatrixDecision,
  TextTemplate,
  CommunicationMessage,
  Cennik,
  CennikiPayload,
  LinkItem,
  HomeSpotlight,
  HomeQuickLink,
  ContactEntry,
  PhraseEntry,
  OrgEntry,
  Announcement,
} from "@/lib/types/domain";
import type { ResolvedModuleSettingsMap } from "@/lib/config/modules";
import type { LeadConfig } from "@/lib/types/lead";
import { CURRENT_SCHEMA_VERSION } from "@/lib/data/store";
import { adaptProjectBootstrapLeadConfig } from "@/lib/api/project-bootstrap";
import { replaceProjectLeadConfig } from "@/lib/api/project-configuration";
import type {
  DataExportDiagnostics,
  DataImportDiagnostics,
  DataLoadDiagnostics,
  DataStorageMode,
  UploadFileOptions,
  UploadFileResult,
} from "@/lib/data/access";
import { useToast } from "@/contexts/toast-context";
import {
  PlatformScopeProvider,
  usePlatformScope,
  type DataPersistenceState,
  type PlatformBootstrapState,
} from "@/contexts/platform-scope-provider";
import {
  ProjectScopeProvider,
  useProjectScope,
  type ProjectBootstrapState,
  type ShellCutover,
} from "@/contexts/project-scope-provider";
import { AnnouncementsProvider, useAnnouncementsModule } from "@/contexts/modules/announcements-provider";
import type { AnnouncementsModuleState } from "@/contexts/modules/announcements-provider";
import { CennikiProvider, useCennikiModule } from "@/contexts/modules/cenniki-provider";
import type { CennikiModuleState } from "@/contexts/modules/cenniki-provider";
import { CommunicationsProvider, useCommunicationsModule } from "@/contexts/modules/communications-provider";
import type { CommunicationsModuleState } from "@/contexts/modules/communications-provider";
import { ContactsProvider, useContactsModule } from "@/contexts/modules/contacts-provider";
import type { ContactsModuleState } from "@/contexts/modules/contacts-provider";
import { ImportantTopicsProvider, useImportantTopicsModule } from "@/contexts/modules/important-topics-provider";
import type { ImportantTopicsModuleState } from "@/contexts/modules/important-topics-provider";
import { LinksProvider, useLinksModule } from "@/contexts/modules/links-provider";
import type { LinksModuleState } from "@/contexts/modules/links-provider";
import { PhrasesProvider, usePhrasesModule } from "@/contexts/modules/phrases-provider";
import type { PhrasesModuleState } from "@/contexts/modules/phrases-provider";
import { QuickLinksProvider, useQuickLinksModule } from "@/contexts/modules/quick-links-provider";
import type { QuickLinksModuleState } from "@/contexts/modules/quick-links-provider";
import type { ProjectModuleDeps } from "@/contexts/modules/shared-module-types";
import { TemplatesProvider, useTemplatesModule } from "@/contexts/modules/templates-provider";
import type { TemplatesModuleState } from "@/contexts/modules/templates-provider";
import { KnowledgeProvider, useKnowledgeModule } from "@/contexts/modules/knowledge-provider";
import { MatrixProvider, useMatrixModule } from "@/contexts/modules/matrix-provider";
import type { MatrixModuleState } from "@/contexts/modules/matrix-provider";

function sanitizeLeadConfigPhraseReferences(
  config: LeadConfig,
  phrases: Pick<PhraseEntry, "id">[]
): LeadConfig {
  const availablePhraseIds = new Set(phrases.map((phrase) => phrase.id));
  let changed = false;

  const rules = config.rules.map((rule) => {
    const phraseIdTrwala =
      rule.phraseIdTrwala && availablePhraseIds.has(rule.phraseIdTrwala)
        ? rule.phraseIdTrwala
        : undefined;
    const phraseIdJednorazowa =
      rule.phraseIdJednorazowa && availablePhraseIds.has(rule.phraseIdJednorazowa)
        ? rule.phraseIdJednorazowa
        : undefined;

    if (
      phraseIdTrwala === rule.phraseIdTrwala &&
      phraseIdJednorazowa === rule.phraseIdJednorazowa
    ) {
      return rule;
    }

    changed = true;

    return {
      ...rule,
      phraseIdTrwala,
      phraseIdJednorazowa,
    };
  });

  return changed ? { ...config, rules } : config;
}

export type {
  PersistenceStatus,
  PlatformBootstrapState,
  DataPersistenceState,
} from "@/contexts/platform-scope-provider";
export type {
  ProjectBootstrapState,
  ShellCurrentUserDisplay,
  ShellProjectBranding,
  ShellNavigationOverride,
  ShellCutover,
} from "@/contexts/project-scope-provider";
export { NAV_MODULE_KEYS } from "@/contexts/project-scope-provider";
export type { MatrixModuleState } from "@/contexts/modules/matrix-provider";

// ── Context type ──────────────────────────────────────────────────────────────

type DataContextValue = {
  data: AppData;
  isLoading: boolean;
  loadError: string;
  platformBootstrapState: PlatformBootstrapState;
  projectBootstrapState: ProjectBootstrapState;
  shellCutover: ShellCutover;
  quickLinksModule: QuickLinksModuleState;
  linksModule: LinksModuleState;
  announcementsModule: AnnouncementsModuleState;
  contactsModule: ContactsModuleState;
  matrixModule: MatrixModuleState;
  templatesModule: TemplatesModuleState;
  communicationsModule: CommunicationsModuleState;
  cennikiModule: CennikiModuleState;
  phrasesModule: PhrasesModuleState;
  importantTopicsModule: ImportantTopicsModuleState;
  // ─ Derived collections ─
  categories: KnowledgeCategoryEntry[];
  categoryTree: CategoryNode[];
  pages: KnowledgePage[];
  matrix: MatrixDecision[];
  templates: TextTemplate[];
  communications: CommunicationMessage[];
  cenniki: CennikiPayload;
  links: LinkItem[];
  // ─ Mutations (admin only) ─
  /** Replace the entire data tree and persist through the active storage adapter. */
  setData: (next: AppData) => void;
  /** Update only the admin PIN hash. */
  updateAuthHashes: (adminPinHash: string) => void;
  /** Add a new category. ID is generated if not provided. */
  addCategory: (cat: Omit<KnowledgeCategoryEntry, "id"> & { id?: string }) => Promise<KnowledgeCategoryEntry>;
  /** Replace a category by id. */
  updateCategory: (updated: KnowledgeCategoryEntry) => Promise<void>;
  /** Delete a category by id. Returns an error if it still has subcategories or linked pages. */
  deleteCategory: (id: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  /** Add a new page. ID is generated if not provided. */
  addPage: (page: Omit<KnowledgePage, "id"> & { id?: string }) => Promise<KnowledgePage>;
  /** Replace a page by id. */
  updatePage: (updated: KnowledgePage) => Promise<void>;
  /** Delete a page by id. */
  deletePage: (id: string) => Promise<void>;
  /** Add a new matrix entry. ID is generated if not provided. */
  addMatrixEntry: (entry: Omit<MatrixDecision, "id"> & { id?: string }) => MatrixDecision;
  /** Replace a matrix entry by id. */
  updateMatrixEntry: (updated: MatrixDecision) => void;
  /** Delete a matrix entry by id. */
  deleteMatrixEntry: (id: string) => void;
  /** Reorder categories sharing the same parentId by assigning new sortOrder values. */
  reorderCategories: (parentId: string | null, orderedItems: KnowledgeCategoryEntry[]) => void | Promise<void>;
  /** Reorder pages within a category by assigning new sortOrder values. */
  reorderPages: (categoryId: string, orderedItems: KnowledgePage[]) => void | Promise<void>;
  /** Set the unified display order of a category’s direct children (mix of article and subcategory IDs). */
  reorderCategoryChildren: (categoryId: string, orderedIds: string[]) => void | Promise<void>;
  /** Reorder the top-level matrix category groups. */
  reorderMatrixCategories: (orderedCategoryNames: string[]) => void;
  /** Reorder entries within a single matrix category. */
  reorderMatrixInCategory: (categoryName: string, orderedItems: MatrixDecision[]) => void;
  /** Ordered list of distinct matrix category names (derived + persisted). */
  matrixCategoryOrder: string[];
  /** Add a new template. ID is generated if not provided. */
  addTemplate: (t: Omit<TextTemplate, "id"> & { id?: string }) => TextTemplate;
  /** Replace a template by id. */
  updateTemplate: (updated: TextTemplate) => void;
  /** Delete a template by id. */
  deleteTemplate: (id: string) => void;
  /** Reorder all templates by assigning new sortOrder values. */
  reorderTemplates: (orderedItems: TextTemplate[]) => void;
  /** Add a new komunikat. ID is generated if not provided. */
  addCommunication: (c: Omit<CommunicationMessage, "id"> & { id?: string }) => CommunicationMessage;
  /** Replace a komunikat by id. */
  updateCommunication: (updated: CommunicationMessage) => void;
  /** Delete a komunikat by id. */
  deleteCommunication: (id: string) => void;
  /** Add a new cennik document. ID is generated if not provided. */
  addCennik: (c: Omit<Cennik, "id"> & { id?: string }) => Cennik;
  /** Replace a cennik document by id. */
  updateCennik: (updated: Cennik) => void;
  /** Delete a cennik document by id. */
  deleteCennik: (id: string) => void;
  /** Add a new link. ID is generated if not provided. */
  addLink: (link: Omit<LinkItem, "id"> & { id?: string }) => LinkItem;
  /** Replace a link by id. */
  updateLink: (updated: LinkItem) => void;
  /** Delete a link by id. */
  deleteLink: (id: string) => void;
  /** Reorder all links by assigning new sortOrder values. */
  reorderLinks: (orderedItems: LinkItem[]) => void;
  /** Curated article spotlights shown in "Ważne tematy" on the homepage. */
  homeSpotlights: HomeSpotlight[];
  /** Replace the entire homeSpotlights list (used by admin management). */
  setHomeSpotlights: (items: HomeSpotlight[]) => Promise<void>;
  /** Curated quick links shown in "Szybkie linki" on the homepage. */
  homeQuickLinks: HomeQuickLink[];
  /** Replace the entire homeQuickLinks list (used by admin management). */
  setHomeQuickLinks: (items: HomeQuickLink[]) => void;
  /** All contact entries in display/sort order. */
  contacts: ContactEntry[];
  /** Add a new contact. ID is generated if not provided. */
  addContact: (c: Omit<ContactEntry, "id"> & { id?: string }) => ContactEntry;
  /** Replace a contact entry by id. */
  updateContact: (updated: ContactEntry) => void;
  /** Delete a contact entry by id. */
  deleteContact: (id: string) => void;
  /** Reorder all contacts by assigning new sortOrder values. */
  reorderContacts: (orderedItems: ContactEntry[]) => void;
  /** All ready-to-use phrase entries in display/sort order. */
  phrases: PhraseEntry[];
  /** Add a new phrase. ID is generated if not provided. */
  addPhrase: (p: Omit<PhraseEntry, "id"> & { id?: string }) => PhraseEntry;
  /** Replace a phrase entry by id. */
  updatePhrase: (updated: PhraseEntry) => void;
  /** Delete a phrase entry by id. */
  deletePhrase: (id: string) => void;
  /** Reorder all phrases by assigning new sortOrder values. */
  reorderPhrases: (orderedItems: PhraseEntry[]) => void;
  /** All organizational topic entries. */
  orgEntries: OrgEntry[];
  /** Add a new org entry. ID is generated if not provided. */
  addOrgEntry: (e: Omit<OrgEntry, "id"> & { id?: string }) => OrgEntry;
  /** Replace an org entry by id. */
  updateOrgEntry: (updated: OrgEntry) => void;
  /** Delete an org entry by id. */
  deleteOrgEntry: (id: string) => void;
  /** Ordered list of main navigation module keys (stable route-key identifiers). */
  navOrder: string[];
  /** Replace the stored navigation order. */
  setNavOrder: (order: string[]) => Promise<void>;
  /** Deployment-specific module toggles. */
  enabledModules: Record<AppModuleKey, boolean>;
  /** Resolved per-module deployment settings. */
  moduleSettings: ResolvedModuleSettingsMap;
  /** Enable/disable an optional module for this deployment. */
  setModuleEnabled: (moduleKey: AppModuleKey, enabled: boolean) => Promise<void>;
  /** Replace settings for a single module in deployment configuration. */
  setModuleSettings: <K extends AppModuleKey>(
    moduleKey: K,
    settings: NonNullable<AppModuleSettingsMap[K]>
  ) => Promise<void>;
  /** Separated project configuration payload (non-content settings). */
  projectConfiguration: AppConfiguration;
  /** Technical/system settings payload (identity/deployment metadata). */
  systemSettings: AppSystemSettings;
  /** Replace system/technical settings in one operation. */
  setSystemSettings: (next: AppSystemSettings) => void;
  /** Update backend-backed identifiers for the active project. */
  updateProjectMetadata: (input: { slug: string; code: string; name: string }) => Promise<{
    slug: string;
    code: string;
    name: string;
  }>;
  // ─ JSON workflow ─
  appBuildVersion: string | null;
  currentSchemaVersion: number;
  dataSchemaVersion: number | null;
  lastLoadDiagnostics: DataLoadDiagnostics | null;
  lastImportDiagnostics: DataImportDiagnostics | null;
  lastExportDiagnostics: DataExportDiagnostics | null;
  dataStorageMode: DataStorageMode;
  persistenceState: DataPersistenceState;
  /** Re-attempts persisting pending in-memory changes after a failed save. */
  retryPendingSave: () => void;
  exportData: (filename?: string) => DataExportDiagnostics;
  importData: (jsonString: string) => {
    ok: boolean;
    error?: string;
    diagnostics?: DataImportDiagnostics;
  };
  reloadData: () => Promise<{ ok: boolean; error?: string }>;
  resetToDefault: () => Promise<{ ok: boolean; error?: string }>;
  /** Removes the localStorage override key. In-memory state is NOT changed.
   *  After this, a fresh page load will fall back to the bundled JSON. */
  clearLocalOverrides: () => void;
  /** Future-ready upload integration point used by API-assisted deployments. */
  uploadFile: (file: File, options?: UploadFileOptions) => Promise<UploadFileResult>;
  /** True when the app is running from localStorage overrides rather than bundled JSON. */
  localOverrideActive: boolean;
  /** True when a local override key exists but is intentionally ignored in API mode. */
  storedLocalOverrideAvailable: boolean;
  /** All navbar announcements. */
  announcements: Announcement[];
  /** Add a new announcement. ID is generated if not provided. */
  addAnnouncement: (a: Omit<Announcement, "id"> & { id?: string }) => Announcement;
  /** Replace an announcement by id. */
  updateAnnouncement: (updated: Announcement) => void;
  /** Delete an announcement by id. */
  deleteAnnouncement: (id: string) => void;
  /** Full lead-qualification widget configuration. */
  leadConfig: LeadConfig;
  /** Replace the entire lead configuration and persist. */
  setLeadConfig: (config: LeadConfig) => Promise<void>;
};

const DataContext = createContext<DataContextValue | null>(null);

export function DataProvider({ children }: { children: React.ReactNode }) {
  return (
    <PlatformScopeProvider>
      <ProjectScopeProvider>
        <DataProviderModules>{children}</DataProviderModules>
      </ProjectScopeProvider>
    </PlatformScopeProvider>
  );
}

function DataProviderModules({ children }: { children: React.ReactNode }) {
  const platform = usePlatformScope();
  const project = useProjectScope();

  const moduleDeps = useMemo<ProjectModuleDeps>(
    () => ({
      activeProjectSlug: project.activeProjectSlug,
      apiMode: platform.apiMode,
      apiRuntimeRefreshKey: platform.apiRuntimeRefreshKey,
      legacyData: platform.data,
      setLegacyData: platform.setData,
    }),
    [
      project.activeProjectSlug,
      platform.apiMode,
      platform.apiRuntimeRefreshKey,
      platform.data,
      platform.setData,
    ]
  );

  return (
    <KnowledgeProvider deps={moduleDeps}>
      <MatrixProvider deps={moduleDeps}>
        <AnnouncementsProvider deps={moduleDeps}>
          <ContactsProvider deps={moduleDeps}>
            <LinksProvider deps={moduleDeps}>
              <QuickLinksProvider deps={moduleDeps}>
                <ImportantTopicsProvider deps={moduleDeps}>
                  <CennikiProvider deps={moduleDeps}>
                    <CommunicationsProvider deps={moduleDeps}>
                      <TemplatesProvider deps={moduleDeps}>
                        <PhrasesProvider deps={moduleDeps}>
                          <DataProviderFacade>{children}</DataProviderFacade>
                        </PhrasesProvider>
                      </TemplatesProvider>
                    </CommunicationsProvider>
                  </CennikiProvider>
                </ImportantTopicsProvider>
              </QuickLinksProvider>
            </LinksProvider>
          </ContactsProvider>
        </AnnouncementsProvider>
      </MatrixProvider>
    </KnowledgeProvider>
  );
}

function DataProviderFacade({ children }: { children: React.ReactNode }) {
  const { push: toast } = useToast();
  const platform = usePlatformScope();
  const project = useProjectScope();
  const knowledge = useKnowledgeModule();
  const matrix = useMatrixModule();
  const announcementsFacade = useAnnouncementsModule();
  const contactsFacade = useContactsModule();
  const linksFacade = useLinksModule();
  const quickLinksFacade = useQuickLinksModule();
  const importantTopicsFacade = useImportantTopicsModule();
  const cennikiFacade = useCennikiModule();
  const communicationsFacade = useCommunicationsModule();
  const templatesFacade = useTemplatesModule();
  const phrasesFacade = usePhrasesModule();

  const effectiveIsLoading = platform.isLoading || knowledge.contributesToAppLoading;
  const effectiveLoadError = platform.loadError || knowledge.knowledgeError || "";

  const resolvedLeadConfig = useMemo(() => {
    const fallbackConfig = platform.data.leadConfig ?? { questions: [], rules: [] };

    if (!project.bootstrapProjectConfiguration) {
      return sanitizeLeadConfigPhraseReferences(fallbackConfig, phrasesFacade.phrases);
    }

    const adapted = adaptProjectBootstrapLeadConfig(project.bootstrapProjectConfiguration);
    return sanitizeLeadConfigPhraseReferences(
      adapted.managed ? adapted.config : fallbackConfig,
      phrasesFacade.phrases
    );
  }, [phrasesFacade.phrases, platform.data.leadConfig, project.bootstrapProjectConfiguration]);

  const runtimeData = useMemo<AppData>(
    () => ({
      ...platform.data,
      categories: knowledge.categories,
      pages: knowledge.pages,
      matrix: matrix.matrix,
      announcements: announcementsFacade.announcements,
      contacts: contactsFacade.contacts,
      homeQuickLinks: quickLinksFacade.homeQuickLinks,
      links: linksFacade.links,
      templates: templatesFacade.templates,
      communications: communicationsFacade.communications,
      cenniki: cennikiFacade.cenniki,
      orgEntries: importantTopicsFacade.orgEntries,
      phrases: phrasesFacade.phrases,
      configuration: project.projectConfiguration,
      homeSpotlights: project.resolvedHomeSpotlights,
      leadConfig: resolvedLeadConfig,
    }),
    [
      announcementsFacade.announcements,
      cennikiFacade.cenniki,
      communicationsFacade.communications,
      contactsFacade.contacts,
      importantTopicsFacade.orgEntries,
      knowledge.categories,
      knowledge.pages,
      linksFacade.links,
      matrix.matrix,
      phrasesFacade.phrases,
      platform.data,
      project.projectConfiguration,
      project.resolvedHomeSpotlights,
      quickLinksFacade.homeQuickLinks,
      resolvedLeadConfig,
      templatesFacade.templates,
    ]
  );

  const setLeadConfig = useCallback(
    async (config: LeadConfig): Promise<void> => {
      const sanitizedConfig = sanitizeLeadConfigPhraseReferences(config, phrasesFacade.phrases);

      if (!platform.apiMode) {
        platform.setData({ ...platform.data, leadConfig: sanitizedConfig });
        return;
      }

      try {
        const payload = await replaceProjectLeadConfig(project.activeProjectSlug, sanitizedConfig);
        project.syncProjectBootstrapConfiguration(payload.data.configuration);
      } catch (caught) {
        const message =
          caught instanceof Error
            ? caught.message
            : "Nie udało się zapisać konfiguracji kwalifikacji leada.";
        toast("error", message);
        throw new Error(message);
      }
    },
    [phrasesFacade.phrases, platform, project, toast]
  );

  const value = useMemo<DataContextValue>(
    () => ({
      data: runtimeData,
      isLoading: effectiveIsLoading,
      loadError: effectiveLoadError,
      platformBootstrapState: platform.platformBootstrapState,
      projectBootstrapState: project.projectBootstrapState,
      shellCutover: project.shellCutover,
      quickLinksModule: quickLinksFacade.quickLinksModule,
      linksModule: linksFacade.linksModule,
      announcementsModule: announcementsFacade.announcementsModule,
      contactsModule: contactsFacade.contactsModule,
      matrixModule: matrix.matrixModule,
      templatesModule: templatesFacade.templatesModule,
      communicationsModule: communicationsFacade.communicationsModule,
      cennikiModule: cennikiFacade.cennikiModule,
      phrasesModule: phrasesFacade.phrasesModule,
      importantTopicsModule: importantTopicsFacade.importantTopicsModule,
      categories: knowledge.categories,
      categoryTree: knowledge.categoryTree,
      pages: knowledge.pages,
      matrix: matrix.matrix,
      templates: templatesFacade.templates,
      communications: communicationsFacade.communications,
      cenniki: cennikiFacade.cenniki,
      links: linksFacade.links,
      homeSpotlights: runtimeData.homeSpotlights ?? [],
      homeQuickLinks: quickLinksFacade.homeQuickLinks,
      contacts: contactsFacade.contacts,
      phrases: phrasesFacade.phrases,
      orgEntries: importantTopicsFacade.orgEntries,
      addOrgEntry: importantTopicsFacade.addOrgEntry,
      updateOrgEntry: importantTopicsFacade.updateOrgEntry,
      deleteOrgEntry: importantTopicsFacade.deleteOrgEntry,
      announcements: announcementsFacade.announcements,
      addAnnouncement: announcementsFacade.addAnnouncement,
      updateAnnouncement: announcementsFacade.updateAnnouncement,
      deleteAnnouncement: announcementsFacade.deleteAnnouncement,
      leadConfig: runtimeData.leadConfig ?? { questions: [], rules: [] },
      setLeadConfig,
      setHomeSpotlights: project.setHomeSpotlights,
      setHomeQuickLinks: quickLinksFacade.setHomeQuickLinks,
      addContact: contactsFacade.addContact,
      updateContact: contactsFacade.updateContact,
      deleteContact: contactsFacade.deleteContact,
      reorderContacts: contactsFacade.reorderContacts,
      addPhrase: phrasesFacade.addPhrase,
      updatePhrase: phrasesFacade.updatePhrase,
      deletePhrase: phrasesFacade.deletePhrase,
      reorderPhrases: phrasesFacade.reorderPhrases,
      navOrder: project.navOrder,
      setNavOrder: project.setNavOrder,
      enabledModules: project.enabledModules,
      moduleSettings: project.moduleSettings,
      setModuleEnabled: project.setModuleEnabled,
      setModuleSettings: project.setModuleSettings,
      projectConfiguration: project.projectConfiguration,
      systemSettings: platform.systemSettings,
      setSystemSettings: platform.setSystemSettings,
      updateProjectMetadata: project.updateProjectMetadata,
      appBuildVersion: platform.appBuildVersion,
      currentSchemaVersion: CURRENT_SCHEMA_VERSION,
      dataSchemaVersion: platform.dataSchemaVersion,
      lastLoadDiagnostics: platform.lastLoadDiagnostics,
      lastImportDiagnostics: platform.lastImportDiagnostics,
      lastExportDiagnostics: platform.lastExportDiagnostics,
      dataStorageMode: platform.dataStorageMode,
      persistenceState: platform.persistenceState,
      retryPendingSave: platform.retryPendingSave,
      setData: platform.setData,
      updateAuthHashes: platform.updateAuthHashes,
      addCategory: knowledge.addCategory,
      updateCategory: knowledge.updateCategory,
      deleteCategory: knowledge.deleteCategory,
      addPage: knowledge.addPage,
      updatePage: knowledge.updatePage,
      deletePage: knowledge.deletePage,
      addMatrixEntry: matrix.addMatrixEntry,
      updateMatrixEntry: matrix.updateMatrixEntry,
      deleteMatrixEntry: matrix.deleteMatrixEntry,
      reorderCategories: knowledge.reorderCategories,
      reorderPages: knowledge.reorderPages,
      reorderCategoryChildren: knowledge.reorderCategoryChildren,
      reorderMatrixCategories: matrix.reorderMatrixCategories,
      reorderMatrixInCategory: matrix.reorderMatrixInCategory,
      matrixCategoryOrder: matrix.matrixCategoryOrder,
      addTemplate: templatesFacade.addTemplate,
      updateTemplate: templatesFacade.updateTemplate,
      deleteTemplate: templatesFacade.deleteTemplate,
      reorderTemplates: templatesFacade.reorderTemplates,
      addCommunication: communicationsFacade.addCommunication,
      updateCommunication: communicationsFacade.updateCommunication,
      deleteCommunication: communicationsFacade.deleteCommunication,
      addCennik: cennikiFacade.addCennik,
      updateCennik: cennikiFacade.updateCennik,
      deleteCennik: cennikiFacade.deleteCennik,
      addLink: linksFacade.addLink,
      updateLink: linksFacade.updateLink,
      deleteLink: linksFacade.deleteLink,
      reorderLinks: linksFacade.reorderLinks,
      exportData: platform.exportData,
      importData: platform.importData,
      reloadData: platform.reloadData,
      resetToDefault: platform.resetToDefault,
      clearLocalOverrides: platform.clearLocalOverrides,
      uploadFile: (file, options) =>
        platform.uploadFile(file, { ...options, projectSlug: project.activeProjectSlug }),
      localOverrideActive: platform.localOverrideActive,
      storedLocalOverrideAvailable: platform.storedLocalOverrideAvailable,
    }),
    [
      runtimeData,
      effectiveIsLoading,
      effectiveLoadError,
      platform,
      project,
      knowledge,
      matrix,
      quickLinksFacade,
      linksFacade,
      announcementsFacade,
      contactsFacade,
      cennikiFacade,
      communicationsFacade,
      importantTopicsFacade,
      phrasesFacade,
      templatesFacade,
      setLeadConfig,
    ]
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  const context = useContext(DataContext);
  if (!context) throw new Error("useData must be used inside DataProvider");
  return context;
}
