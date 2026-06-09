import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { TextTemplate } from "@/lib/types/domain";
import { generateId } from "@/lib/utils";
import {
  adaptProjectTemplate,
  adaptProjectTemplates,
  createProjectTemplate,
  deleteProjectTemplate,
  fetchProjectTemplates,
  reorderProjectTemplates,
  updateProjectTemplate,
  type CreateProjectTemplateInput,
  type UpdateProjectTemplateInput,
} from "@/lib/api/project-templates";
import type { ModuleDataSource, ProjectModuleDeps } from "./shared-module-types";

export type TemplatesModuleState = {
  source: ModuleDataSource;
  isLoading: boolean;
  isMutating: boolean;
  error: string | null;
  canWrite: boolean;
  canReorder: boolean;
  createTemplate: (input: CreateProjectTemplateInput) => Promise<void>;
  editTemplate: (id: string, input: UpdateProjectTemplateInput) => Promise<void>;
  removeTemplate: (id: string) => Promise<void>;
  reorderTemplates: (orderedItems: TextTemplate[]) => void;
};

type TemplatesContextValue = {
  templates: TextTemplate[];
  addTemplate: (t: Omit<TextTemplate, "id"> & { id?: string }) => TextTemplate;
  updateTemplate: (updated: TextTemplate) => void;
  deleteTemplate: (id: string) => void;
  reorderTemplates: (orderedItems: TextTemplate[]) => void;
  templatesModule: TemplatesModuleState;
};

const TemplatesModuleContext = createContext<TemplatesContextValue | null>(null);

function sortTemplates(items: TextTemplate[]): TextTemplate[] {
  return [...items].sort(
    (left, right) => left.sortOrder - right.sortOrder || left.title.localeCompare(right.title, "pl")
  );
}

export function TemplatesProvider({
  deps,
  children,
}: {
  deps: ProjectModuleDeps;
  children: React.ReactNode;
}) {
  const [apiTemplates, setApiTemplates] = useState<TextTemplate[] | null>(null);
  const [isTemplatesLoading, setIsTemplatesLoading] = useState(false);
  const [isTemplatesMutating, setIsTemplatesMutating] = useState(false);
  const [templatesError, setTemplatesError] = useState<string | null>(null);

  useEffect(() => {
    if (!deps.apiMode) {
      setApiTemplates(null);
      setIsTemplatesLoading(false);
      setIsTemplatesMutating(false);
      setTemplatesError(null);
      return;
    }

    const controller = new AbortController();

    setIsTemplatesLoading(true);
    setTemplatesError(null);

    void (async () => {
      try {
        const payload = await fetchProjectTemplates(deps.activeProjectSlug, controller.signal);

        if (controller.signal.aborted) {
          return;
        }

        setApiTemplates(sortTemplates(adaptProjectTemplates(payload)));
      } catch (caught) {
        if (controller.signal.aborted) {
          return;
        }

        setApiTemplates(null);
        setTemplatesError(
          caught instanceof Error ? caught.message : "Nie udało się załadować szablonów z backendu."
        );
      } finally {
        if (!controller.signal.aborted) {
          setIsTemplatesLoading(false);
        }
      }
    })();

    return () => {
      controller.abort();
    };
  }, [deps.activeProjectSlug, deps.apiMode, deps.apiRuntimeRefreshKey]);

  const resolvedTemplates = useMemo<TextTemplate[]>(
    () =>
      deps.apiMode
        ? apiTemplates ?? ((deps.legacyData.templates ?? []) as TextTemplate[])
        : ((deps.legacyData.templates ?? []) as TextTemplate[]),
    [apiTemplates, deps.apiMode, deps.legacyData.templates]
  );

  const addTemplate = useCallback(
    (t: Omit<TextTemplate, "id"> & { id?: string }): TextTemplate => {
      const full: TextTemplate = { ...t, id: t.id ?? generateId("tpl") };
      deps.setLegacyData({
        ...deps.legacyData,
        templates: [...(deps.legacyData.templates ?? []), full],
      });
      return full;
    },
    [deps]
  );

  const updateTemplate = useCallback(
    (updated: TextTemplate): void => {
      deps.setLegacyData({
        ...deps.legacyData,
        templates: (deps.legacyData.templates ?? []).map((template: TextTemplate) =>
          template.id === updated.id ? updated : template
        ),
      });
    },
    [deps]
  );

  const deleteTemplate = useCallback(
    (id: string): void => {
      deps.setLegacyData({
        ...deps.legacyData,
        templates: (deps.legacyData.templates ?? []).filter((template: TextTemplate) => template.id !== id),
      });
    },
    [deps]
  );

  const reorderTemplates = useCallback(
    (orderedItems: TextTemplate[]): void => {
      const updated = (deps.legacyData.templates ?? []).map((template: TextTemplate) => {
        const idx = orderedItems.findIndex((ordered) => ordered.id === template.id);
        return idx === -1 ? template : { ...template, sortOrder: idx };
      });
      deps.setLegacyData({ ...deps.legacyData, templates: updated });
    },
    [deps]
  );

  const createManagedTemplate = useCallback(
    async (input: CreateProjectTemplateInput): Promise<void> => {
      if (!deps.apiMode) {
        const nowIso = new Date().toISOString();

        addTemplate({
          title: input.title,
          channel: input.channel,
          body: input.body,
          example: input.example,
          sortOrder: resolvedTemplates.length,
          createdAt: nowIso,
          updatedAt: nowIso,
        });
        return;
      }

      if (apiTemplates === null) {
        throw new Error("Backend templates are not ready yet.");
      }

      setIsTemplatesMutating(true);
      setTemplatesError(null);

      try {
        const payload = await createProjectTemplate(deps.activeProjectSlug, input);
        setApiTemplates(sortTemplates([...apiTemplates, adaptProjectTemplate(payload.data.item)]));
      } catch (caught) {
        const message = caught instanceof Error ? caught.message : "Nie udało się dodać szablonu.";
        setTemplatesError(message);
        throw new Error(message);
      } finally {
        setIsTemplatesMutating(false);
      }
    },
    [addTemplate, apiTemplates, deps.activeProjectSlug, deps.apiMode, resolvedTemplates.length]
  );

  const editManagedTemplate = useCallback(
    async (id: string, input: UpdateProjectTemplateInput): Promise<void> => {
      if (!deps.apiMode) {
        const existing = resolvedTemplates.find((template) => template.id === id);

        if (!existing) {
          throw new Error("Szablon nie został znaleziony.");
        }

        updateTemplate({
          ...existing,
          title: input.title ?? existing.title,
          channel: input.channel ?? existing.channel,
          body: input.body ?? existing.body,
          example: input.example ?? existing.example,
          sortOrder: input.sortOrder ?? existing.sortOrder,
          updatedAt: new Date().toISOString(),
        });
        return;
      }

      if (apiTemplates === null) {
        throw new Error("Backend templates are not ready yet.");
      }

      setIsTemplatesMutating(true);
      setTemplatesError(null);

      try {
        const payload = await updateProjectTemplate(deps.activeProjectSlug, id, input);
        setApiTemplates(
          sortTemplates(
            apiTemplates.map((template: TextTemplate) =>
              template.id === id ? adaptProjectTemplate(payload.data.item) : template
            )
          )
        );
      } catch (caught) {
        const message = caught instanceof Error ? caught.message : "Nie udało się zaktualizować szablonu.";
        setTemplatesError(message);
        throw new Error(message);
      } finally {
        setIsTemplatesMutating(false);
      }
    },
    [apiTemplates, deps.activeProjectSlug, deps.apiMode, resolvedTemplates, updateTemplate]
  );

  const removeManagedTemplate = useCallback(
    async (id: string): Promise<void> => {
      if (!deps.apiMode) {
        deleteTemplate(id);
        return;
      }

      if (apiTemplates === null) {
        throw new Error("Backend templates are not ready yet.");
      }

      setIsTemplatesMutating(true);
      setTemplatesError(null);

      try {
        await deleteProjectTemplate(deps.activeProjectSlug, id);
        setApiTemplates(apiTemplates.filter((template) => template.id !== id));
      } catch (caught) {
        const message = caught instanceof Error ? caught.message : "Nie udało się usunąć szablonu.";
        setTemplatesError(message);
        throw new Error(message);
      } finally {
        setIsTemplatesMutating(false);
      }
    },
    [apiTemplates, deleteTemplate, deps.activeProjectSlug, deps.apiMode]
  );

  const reorderManagedTemplates = useCallback(
    (orderedItems: TextTemplate[]): void => {
      if (!deps.apiMode) {
        reorderTemplates(orderedItems);
        return;
      }

      if (apiTemplates === null) {
        setTemplatesError("Backend templates are not ready yet.");
        return;
      }

      const previousItems = apiTemplates;
      const nextItems = sortTemplates(orderedItems.map((item, index) => ({ ...item, sortOrder: index })));

      setIsTemplatesMutating(true);
      setTemplatesError(null);
      setApiTemplates(nextItems);

      void (async () => {
        try {
          const payload = await reorderProjectTemplates(
            deps.activeProjectSlug,
            orderedItems.map((item) => item.id)
          );
          setApiTemplates(sortTemplates(adaptProjectTemplates(payload)));
        } catch (caught) {
          const message = caught instanceof Error ? caught.message : "Nie udało się zmienić kolejności szablonów.";
          setApiTemplates(previousItems);
          setTemplatesError(message);
        } finally {
          setIsTemplatesMutating(false);
        }
      })();
    },
    [apiTemplates, deps.activeProjectSlug, deps.apiMode, reorderTemplates]
  );

  const templatesModule = useMemo<TemplatesModuleState>(
    () => ({
      source: deps.apiMode ? "api" : "legacy",
      isLoading: isTemplatesLoading,
      isMutating: isTemplatesMutating,
      error: templatesError,
      canWrite: !deps.apiMode || apiTemplates !== null,
      canReorder: !deps.apiMode || apiTemplates !== null,
      createTemplate: createManagedTemplate,
      editTemplate: editManagedTemplate,
      removeTemplate: removeManagedTemplate,
      reorderTemplates: reorderManagedTemplates,
    }),
    [
      apiTemplates,
      createManagedTemplate,
      deps.apiMode,
      editManagedTemplate,
      isTemplatesLoading,
      isTemplatesMutating,
      removeManagedTemplate,
      reorderManagedTemplates,
      templatesError,
    ]
  );

  const value = useMemo<TemplatesContextValue>(
    () => ({
      templates: resolvedTemplates,
      addTemplate,
      updateTemplate,
      deleteTemplate,
      reorderTemplates,
      templatesModule,
    }),
    [addTemplate, deleteTemplate, reorderTemplates, resolvedTemplates, templatesModule, updateTemplate]
  );

  return <TemplatesModuleContext.Provider value={value}>{children}</TemplatesModuleContext.Provider>;
}

export function useTemplatesModule(): TemplatesContextValue {
  const context = useContext(TemplatesModuleContext);

  if (!context) {
    throw new Error("useTemplatesModule must be used inside TemplatesProvider");
  }

  return context;
}
