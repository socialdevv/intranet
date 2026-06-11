import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ContactEntry } from "@/lib/types/domain";
import {
  adaptProjectContactToEntry,
  adaptProjectContactsToEntries,
  createProjectContact,
  deleteProjectContact,
  fetchProjectContacts,
  reorderProjectContacts,
  updateProjectContact,
  type CreateProjectContactInput,
  type UpdateProjectContactInput,
} from "@/lib/api/project-contacts";
import type { ProjectModuleDeps } from "./shared-module-types";

const LEGACY_MUTATION_ERROR = "Legacy mutations are disabled in API mode";

export type ContactsModuleState = {
  source: "api";
  isLoading: boolean;
  isMutating: boolean;
  error: string | null;
  canWrite: boolean;
  canReorder: boolean;
  createContact: (input: CreateProjectContactInput) => Promise<void>;
  editContact: (id: string, input: UpdateProjectContactInput) => Promise<void>;
  removeContact: (id: string) => Promise<void>;
  reorderContacts: (orderedItems: ContactEntry[]) => void;
};

type ContactsContextValue = {
  contacts: ContactEntry[];
  addContact: (c: Omit<ContactEntry, "id"> & { id?: string }) => ContactEntry;
  updateContact: (updated: ContactEntry) => void;
  deleteContact: (id: string) => void;
  reorderContacts: (orderedItems: ContactEntry[]) => void;
  contactsModule: ContactsModuleState;
};

const ContactsModuleContext = createContext<ContactsContextValue | null>(null);

function sortContacts(items: ContactEntry[]): ContactEntry[] {
  return [...items].sort((left, right) => left.sortOrder - right.sortOrder || left.title.localeCompare(right.title));
}

export function ContactsProvider({
  deps,
  children,
}: {
  deps: ProjectModuleDeps;
  children: React.ReactNode;
}) {
  const [apiContacts, setApiContacts] = useState<ContactEntry[] | null>(null);
  const [isContactsLoading, setIsContactsLoading] = useState(false);
  const [isContactsMutating, setIsContactsMutating] = useState(false);
  const [contactsError, setContactsError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    setIsContactsLoading(true);
    setContactsError(null);

    void (async () => {
      try {
        const payload = await fetchProjectContacts(deps.activeProjectSlug, controller.signal);

        if (controller.signal.aborted) {
          return;
        }

        setApiContacts(sortContacts(adaptProjectContactsToEntries(payload)));
      } catch (caught) {
        if (controller.signal.aborted) {
          return;
        }

        setApiContacts(null);
        setContactsError(
          caught instanceof Error ? caught.message : "Nie udało się załadować kontaktów z backendu."
        );
      } finally {
        if (!controller.signal.aborted) {
          setIsContactsLoading(false);
        }
      }
    })();

    return () => {
      controller.abort();
    };
  }, [deps.activeProjectSlug, deps.apiRuntimeRefreshKey]);

  const resolvedContacts = useMemo<ContactEntry[]>(() => apiContacts ?? [], [apiContacts]);

  const addContact = useCallback(
    (_c: Omit<ContactEntry, "id"> & { id?: string }): ContactEntry => {
      throw new Error(LEGACY_MUTATION_ERROR);
    },
    []
  );

  const updateContact = useCallback((_updated: ContactEntry): void => {
    throw new Error(LEGACY_MUTATION_ERROR);
  }, []);

  const deleteContact = useCallback((_id: string): void => {
    throw new Error(LEGACY_MUTATION_ERROR);
  }, []);

  const reorderContacts = useCallback((_orderedItems: ContactEntry[]): void => {
    throw new Error(LEGACY_MUTATION_ERROR);
  }, []);

  const createManagedContact = useCallback(
    async (input: CreateProjectContactInput): Promise<void> => {
      if (apiContacts === null) {
        throw new Error("Backend contacts are not ready yet.");
      }

      setIsContactsMutating(true);
      setContactsError(null);

      try {
        const payload = await createProjectContact(deps.activeProjectSlug, input);
        setApiContacts(sortContacts([...apiContacts, adaptProjectContactToEntry(payload.data.item)]));
      } catch (caught) {
        const message = caught instanceof Error ? caught.message : "Nie udało się dodać kontaktu.";
        setContactsError(message);
        throw new Error(message);
      } finally {
        setIsContactsMutating(false);
      }
    },
    [apiContacts, deps.activeProjectSlug]
  );

  const editManagedContact = useCallback(
    async (id: string, input: UpdateProjectContactInput): Promise<void> => {
      if (apiContacts === null) {
        throw new Error("Backend contacts are not ready yet.");
      }

      setIsContactsMutating(true);
      setContactsError(null);

      try {
        const payload = await updateProjectContact(deps.activeProjectSlug, id, input);
        setApiContacts(
          sortContacts(
            apiContacts.map((contact: ContactEntry) =>
              contact.id === id ? adaptProjectContactToEntry(payload.data.item) : contact
            )
          )
        );
      } catch (caught) {
        const message = caught instanceof Error ? caught.message : "Nie udało się zaktualizować kontaktu.";
        setContactsError(message);
        throw new Error(message);
      } finally {
        setIsContactsMutating(false);
      }
    },
    [apiContacts, deps.activeProjectSlug]
  );

  const removeManagedContact = useCallback(
    async (id: string): Promise<void> => {
      if (apiContacts === null) {
        throw new Error("Backend contacts are not ready yet.");
      }

      setIsContactsMutating(true);
      setContactsError(null);

      try {
        await deleteProjectContact(deps.activeProjectSlug, id);
        setApiContacts(apiContacts.filter((contact) => contact.id !== id));
      } catch (caught) {
        const message = caught instanceof Error ? caught.message : "Nie udało się usunąć kontaktu.";
        setContactsError(message);
        throw new Error(message);
      } finally {
        setIsContactsMutating(false);
      }
    },
    [apiContacts, deps.activeProjectSlug]
  );

  const reorderManagedContacts = useCallback(
    (orderedItems: ContactEntry[]): void => {
      if (apiContacts === null) {
        setContactsError("Backend contacts are not ready yet.");
        return;
      }

      const previousItems = apiContacts;
      const nextItems = sortContacts(orderedItems.map((item, index) => ({ ...item, sortOrder: index })));

      setIsContactsMutating(true);
      setContactsError(null);
      setApiContacts(nextItems);

      void (async () => {
        try {
          const payload = await reorderProjectContacts(
            deps.activeProjectSlug,
            orderedItems.map((item) => item.id)
          );
          setApiContacts(sortContacts(adaptProjectContactsToEntries(payload)));
        } catch (caught) {
          const message =
            caught instanceof Error ? caught.message : "Nie udało się zmienić kolejności kontaktów.";
          setApiContacts(previousItems);
          setContactsError(message);
        } finally {
          setIsContactsMutating(false);
        }
      })();
    },
    [apiContacts, deps.activeProjectSlug]
  );

  const contactsModule = useMemo<ContactsModuleState>(
    () => ({
      source: "api",
      isLoading: isContactsLoading,
      isMutating: isContactsMutating,
      error: contactsError,
      canWrite: apiContacts !== null,
      canReorder: apiContacts !== null,
      createContact: createManagedContact,
      editContact: editManagedContact,
      removeContact: removeManagedContact,
      reorderContacts: reorderManagedContacts,
    }),
    [
      apiContacts,
      contactsError,
      createManagedContact,
      editManagedContact,
      isContactsLoading,
      isContactsMutating,
      removeManagedContact,
      reorderManagedContacts,
    ]
  );

  const value = useMemo<ContactsContextValue>(
    () => ({
      contacts: resolvedContacts,
      addContact,
      updateContact,
      deleteContact,
      reorderContacts,
      contactsModule,
    }),
    [addContact, contactsModule, deleteContact, reorderContacts, resolvedContacts, updateContact]
  );

  return <ContactsModuleContext.Provider value={value}>{children}</ContactsModuleContext.Provider>;
}

export function useContactsModule(): ContactsContextValue {
  const context = useContext(ContactsModuleContext);

  if (!context) {
    throw new Error("useContactsModule must be used inside ContactsProvider");
  }

  return context;
}
