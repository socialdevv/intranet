import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ContactEntry } from "@/lib/types/domain";
import { generateId } from "@/lib/utils";
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
import type { ModuleDataSource, ProjectModuleDeps } from "./shared-module-types";

export type ContactsModuleState = {
  source: ModuleDataSource;
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
    if (!deps.apiMode) {
      setApiContacts(null);
      setIsContactsLoading(false);
      setIsContactsMutating(false);
      setContactsError(null);
      return;
    }

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
  }, [deps.activeProjectSlug, deps.apiMode, deps.apiRuntimeRefreshKey]);

  const resolvedContacts = useMemo<ContactEntry[]>(
    () =>
      deps.apiMode
        ? apiContacts ?? ((deps.legacyData.contacts ?? []) as ContactEntry[])
        : ((deps.legacyData.contacts ?? []) as ContactEntry[]),
    [apiContacts, deps.apiMode, deps.legacyData.contacts]
  );

  const addContact = useCallback(
    (c: Omit<ContactEntry, "id"> & { id?: string }): ContactEntry => {
      const contacts = deps.legacyData.contacts ?? [];
      const maxOrder = contacts.reduce((mx: number, x: ContactEntry) => Math.max(mx, x.sortOrder), -1);
      const full: ContactEntry = { ...c, id: c.id ?? generateId("contact"), sortOrder: maxOrder + 1 };
      deps.setLegacyData({ ...deps.legacyData, contacts: [...contacts, full] });
      return full;
    },
    [deps]
  );

  const updateContact = useCallback(
    (updated: ContactEntry): void => {
      deps.setLegacyData({
        ...deps.legacyData,
        contacts: (deps.legacyData.contacts ?? []).map((contact: ContactEntry) =>
          contact.id === updated.id ? updated : contact
        ),
      });
    },
    [deps]
  );

  const deleteContact = useCallback(
    (id: string): void => {
      deps.setLegacyData({
        ...deps.legacyData,
        contacts: (deps.legacyData.contacts ?? []).filter((contact: ContactEntry) => contact.id !== id),
      });
    },
    [deps]
  );

  const reorderContacts = useCallback(
    (orderedItems: ContactEntry[]): void => {
      const updated = (deps.legacyData.contacts ?? []).map((contact: ContactEntry) => {
        const idx = orderedItems.findIndex((item) => item.id === contact.id);
        return idx === -1 ? contact : { ...contact, sortOrder: idx };
      });
      deps.setLegacyData({ ...deps.legacyData, contacts: updated });
    },
    [deps]
  );

  const createManagedContact = useCallback(
    async (input: CreateProjectContactInput): Promise<void> => {
      if (!deps.apiMode) {
        addContact({
          title: input.title,
          description: input.description,
          phone: input.phone ?? undefined,
          email: input.email ?? undefined,
          address: input.address ?? undefined,
          detailTable: input.detailTable ?? undefined,
          group: input.group,
          sortOrder: resolvedContacts.length,
        });
        return;
      }

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
    [addContact, apiContacts, deps.activeProjectSlug, deps.apiMode, resolvedContacts.length]
  );

  const editManagedContact = useCallback(
    async (id: string, input: UpdateProjectContactInput): Promise<void> => {
      if (!deps.apiMode) {
        const existing = resolvedContacts.find((contact) => contact.id === id);

        if (!existing) {
          throw new Error("Kontakt nie został znaleziony.");
        }

        updateContact({
          ...existing,
          title: input.title ?? existing.title,
          description: input.description ?? existing.description,
          phone: Object.prototype.hasOwnProperty.call(input, "phone") ? (input.phone ?? undefined) : existing.phone,
          email: Object.prototype.hasOwnProperty.call(input, "email") ? (input.email ?? undefined) : existing.email,
          address: Object.prototype.hasOwnProperty.call(input, "address")
            ? (input.address ?? undefined)
            : existing.address,
          detailTable: Object.prototype.hasOwnProperty.call(input, "detailTable")
            ? (input.detailTable ?? undefined)
            : existing.detailTable,
          group: input.group ?? existing.group,
        });
        return;
      }

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
    [apiContacts, deps.activeProjectSlug, deps.apiMode, resolvedContacts, updateContact]
  );

  const removeManagedContact = useCallback(
    async (id: string): Promise<void> => {
      if (!deps.apiMode) {
        deleteContact(id);
        return;
      }

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
    [apiContacts, deleteContact, deps.activeProjectSlug, deps.apiMode]
  );

  const reorderManagedContacts = useCallback(
    (orderedItems: ContactEntry[]): void => {
      if (!deps.apiMode) {
        reorderContacts(orderedItems);
        return;
      }

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
    [apiContacts, deps.activeProjectSlug, deps.apiMode, reorderContacts]
  );

  const contactsModule = useMemo<ContactsModuleState>(
    () => ({
      source: deps.apiMode ? "api" : "legacy",
      isLoading: isContactsLoading,
      isMutating: isContactsMutating,
      error: contactsError,
      canWrite: !deps.apiMode || apiContacts !== null,
      canReorder: !deps.apiMode || apiContacts !== null,
      createContact: createManagedContact,
      editContact: editManagedContact,
      removeContact: removeManagedContact,
      reorderContacts: reorderManagedContacts,
    }),
    [
      apiContacts,
      contactsError,
      createManagedContact,
      deps.apiMode,
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
