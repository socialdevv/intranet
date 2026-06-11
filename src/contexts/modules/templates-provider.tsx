import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { TextTemplate } from "@/lib/types/domain";
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
import type { ProjectModuleDeps } from "./shared-module-types";

const LEGACY_MUTATION_ERROR = "Legacy mutations are disabled in API mode";

export type TemplatesModuleState = {
  source: "api";
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
  }, [deps.activeProjectSlug, deps.apiRuntimeRefreshKey]);

  const resolvedTemplates = useMemo<TextTemplate[]>(() => apiTemplates ?? [], [apiTemplates]);

  const addTemplate = useCallback(
    (_t: Omit<TextTemplate, "id"> & { id?: string }): TextTemplate => {
      throw new Error(LEGACY_MUTATION_ERROR);
    },
    []
  );

  const updateTemplate = useCallback((_updated: TextTemplate): void => {
    throw new Error(LEGACY_MUTATION_ERROR);
  }, []);

  const deleteTemplate = useCallback((_id: string): void => {
    throw new Error(LEGACY_MUTATION_ERROR);
  }, []);

  const reorderTemplates = useCallback((_orderedItems: TextTemplate[]): void => {
    throw new Error(LEGACY_MUTATION_ERROR);
  }, []);

  const createManagedTemplate = useCallback(
    async (input: CreateProjectTemplateInput): Promise<void> => {
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
    [apiTemplates, deps.activeProjectSlug]
  );

  const editManagedTemplate = useCallback(
    async (id: string, input: UpdateProjectTemplateInput): Promise<void> => {
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
    [apiTemplates, deps.activeProjectSlug]
  );

  const removeManagedTemplate = useCallback(
    async (id: string): Promise<void> => {
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
    [apiTemplates, deps.activeProjectSlug]
  );

  const reorderManagedTemplates = useCallback(
    (orderedItems: TextTemplate[]): void => {
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
    [apiTemplates, deps.activeProjectSlug]
  );

  const templatesModule = useMemo<TemplatesModuleState>(
    () => ({
      source: "api",
      isLoading: isTemplatesLoading,
      isMutating: isTemplatesMutating,
      error: templatesError,
      canWrite: apiTemplates !== null,
      canReorder: apiTemplates !== null,
      createTemplate: createManagedTemplate,
      editTemplate: editManagedTemplate,
      removeTemplate: removeManagedTemplate,
      reorderTemplates: reorderManagedTemplates,
    }),
    [
      apiTemplates,
      createManagedTemplate,
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
