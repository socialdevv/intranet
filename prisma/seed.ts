import {
  CommunicationKind,
  GlobalRole,
  MediaKind,
  ModuleKey,
  Prisma,
  PricingStatus,
  PrismaClient,
  ProjectRole,
  UserStatus,
} from "@prisma/client";

const prisma = new PrismaClient();

const users = [
  {
    key: "superAdmin",
    email: "super.admin@intranet.local",
    displayName: "Super Admin",
    initials: "SA",
    globalRole: GlobalRole.super_admin,
    status: UserStatus.active,
  },
  {
    key: "moderator",
    email: "global.moderator@intranet.local",
    displayName: "Global Moderator",
    initials: "GM",
    globalRole: GlobalRole.global_moderator,
    status: UserStatus.active,
  },
  {
    key: "contentManager",
    email: "content.manager@intranet.local",
    displayName: "Content Manager",
    initials: "CM",
    globalRole: GlobalRole.user,
    status: UserStatus.active,
  },
  {
    key: "projectUser",
    email: "project.user@intranet.local",
    displayName: "Project User",
    initials: "PU",
    globalRole: GlobalRole.user,
    status: UserStatus.active,
  },
] as const;

const projects = [
  {
    key: "altcloud",
    slug: "altcloud",
    code: "ALTCLOUD",
    name: "AltCloud",
    description: "Primary migrated intranet project.",
    isListed: true,
    isActive: true,
    sortOrder: 10,
  },
  {
    key: "beta",
    slug: "beta",
    code: "BETA",
    name: "Beta",
    description: "Secondary listed project used to verify locked-project behavior.",
    isListed: true,
    isActive: true,
    sortOrder: 20,
  },
] as const;

const DEFAULT_MATRIX_MODULE_SETTINGS = {
  rules: {
    matrixCategoryOrder: [
      "Reklamacje",
      "Zgłoszenia techniczne",
      "Płatności i rozliczenia",
    ],
    matrixAdvisoryRules: [
      {
        id: "oze-prosumer-check",
        title: "Sprawdź czy klient jest prosumentem",
        message: "Kierowanie tego zgłoszenia różni się w zależności od statusu OZE klienta.",
        severity: "warning",
        match: {
          criterionValueIncludesAny: ["oze"],
        },
      },
    ],
  },
} satisfies Prisma.InputJsonValue;

function knowledgeDoc(text: string): Prisma.InputJsonValue {
  return {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [{ type: "text", text }],
      },
    ],
  } satisfies Prisma.InputJsonValue;
}

async function main() {
  const userRecords = new Map<string, string>();

  for (const input of users) {
    const user = await prisma.user.upsert({
      where: { email: input.email },
      update: {
        displayName: input.displayName,
        initials: input.initials,
        globalRole: input.globalRole,
        status: input.status,
      },
      create: {
        email: input.email,
        displayName: input.displayName,
        initials: input.initials,
        globalRole: input.globalRole,
        status: input.status,
      },
    });

    userRecords.set(input.key, user.id);
  }

  const projectRecords = new Map<string, string>();

  for (const input of projects) {
    const project = await prisma.project.upsert({
      where: { slug: input.slug },
      update: {
        code: input.code,
        name: input.name,
        description: input.description,
        isListed: input.isListed,
        isActive: input.isActive,
        sortOrder: input.sortOrder,
      },
      create: {
        slug: input.slug,
        code: input.code,
        name: input.name,
        description: input.description,
        isListed: input.isListed,
        isActive: input.isActive,
        sortOrder: input.sortOrder,
      },
    });

    projectRecords.set(input.key, project.id);
  }

  const projectIds = [...projectRecords.values()];

  await prisma.projectMembership.deleteMany({
    where: {
      projectId: {
        in: projectIds,
      },
    },
  });

  await prisma.projectMembership.createMany({
    data: [
      {
        projectId: projectRecords.get("altcloud")!,
        userId: userRecords.get("superAdmin")!,
        effectiveRole: ProjectRole.project_admin,
      },
      {
        projectId: projectRecords.get("beta")!,
        userId: userRecords.get("superAdmin")!,
        effectiveRole: ProjectRole.project_admin,
      },
      {
        projectId: projectRecords.get("altcloud")!,
        userId: userRecords.get("moderator")!,
        effectiveRole: ProjectRole.content_manager,
      },
      {
        projectId: projectRecords.get("altcloud")!,
        userId: userRecords.get("contentManager")!,
        effectiveRole: ProjectRole.content_manager,
      },
      {
        projectId: projectRecords.get("altcloud")!,
        userId: userRecords.get("projectUser")!,
        effectiveRole: ProjectRole.project_user,
      },
    ],
  });

  await prisma.projectModule.deleteMany({
    where: {
      projectId: {
        in: projectIds,
      },
    },
  });

  await prisma.projectModule.createMany({
    data: [
      {
        projectId: projectRecords.get("altcloud")!,
        moduleKey: ModuleKey.matrix,
        enabled: true,
        navVisible: true,
        navOrder: 10,
        settingsJson: DEFAULT_MATRIX_MODULE_SETTINGS,
      },
      {
        projectId: projectRecords.get("altcloud")!,
        moduleKey: ModuleKey.announcements,
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
      {
        projectId: projectRecords.get("altcloud")!,
        moduleKey: ModuleKey.communications,
        enabled: true,
        navVisible: true,
        navOrder: 22,
      },
      {
        projectId: projectRecords.get("altcloud")!,
        moduleKey: ModuleKey.templates,
        enabled: true,
        navVisible: true,
        navOrder: 25,
      },
      {
        projectId: projectRecords.get("altcloud")!,
        moduleKey: ModuleKey.pricing,
        enabled: true,
        navVisible: true,
        navOrder: 26,
      },
      {
        projectId: projectRecords.get("altcloud")!,
        moduleKey: ModuleKey.phrases,
        enabled: true,
        navVisible: true,
        navOrder: 27,
      },
      {
        projectId: projectRecords.get("altcloud")!,
        moduleKey: ModuleKey.links,
        enabled: true,
        navVisible: true,
        navOrder: 30,
      },
      {
        projectId: projectRecords.get("altcloud")!,
        moduleKey: ModuleKey.contacts,
        enabled: true,
        navVisible: true,
        navOrder: 40,
      },
      {
        projectId: projectRecords.get("altcloud")!,
        moduleKey: ModuleKey.important_topics,
        enabled: true,
        navVisible: true,
        navOrder: 50,
      },
      {
        projectId: projectRecords.get("altcloud")!,
        moduleKey: ModuleKey.quick_links,
        enabled: true,
        navVisible: false,
        navOrder: 60,
      },
      {
        projectId: projectRecords.get("altcloud")!,
        moduleKey: ModuleKey.home_sections,
        enabled: true,
        navVisible: false,
        navOrder: 70,
        settingsJson: {
          homepage: {
            showSpotlights: true,
            showQuickLinks: true,
          },
        },
      },
      {
        projectId: projectRecords.get("altcloud")!,
        moduleKey: ModuleKey.lead,
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
      {
        projectId: projectRecords.get("beta")!,
        moduleKey: ModuleKey.announcements,
        enabled: true,
        navVisible: false,
        navOrder: 10,
        settingsJson: {
          surfaces: {
            showTopbarPills: true,
            showHomePills: false,
          },
        },
      },
      {
        projectId: projectRecords.get("beta")!,
        moduleKey: ModuleKey.communications,
        enabled: true,
        navVisible: true,
        navOrder: 22,
      },
      {
        projectId: projectRecords.get("beta")!,
        moduleKey: ModuleKey.templates,
        enabled: true,
        navVisible: true,
        navOrder: 25,
      },
      {
        projectId: projectRecords.get("beta")!,
        moduleKey: ModuleKey.pricing,
        enabled: true,
        navVisible: true,
        navOrder: 26,
      },
      {
        projectId: projectRecords.get("beta")!,
        moduleKey: ModuleKey.phrases,
        enabled: true,
        navVisible: true,
        navOrder: 27,
      },
      {
        projectId: projectRecords.get("beta")!,
        moduleKey: ModuleKey.home_sections,
        enabled: true,
        navVisible: false,
        navOrder: 70,
        settingsJson: {
          homepage: {
            showSpotlights: true,
            showQuickLinks: true,
          },
        },
      },
      {
        projectId: projectRecords.get("beta")!,
        moduleKey: ModuleKey.lead,
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
      {
        projectId: projectRecords.get("beta")!,
        moduleKey: ModuleKey.links,
        enabled: true,
        navVisible: true,
        navOrder: 30,
      },
      {
        projectId: projectRecords.get("beta")!,
        moduleKey: ModuleKey.quick_links,
        enabled: true,
        navVisible: false,
        navOrder: 40,
      },
    ],
  });

  await prisma.projectQuickLink.deleteMany({
    where: {
      projectId: {
        in: projectIds,
      },
    },
  });

  await prisma.projectQuickLink.createMany({
    data: [
      {
        projectId: projectRecords.get("altcloud")!,
        label: "Macierz operacyjna AltCloud",
        url: "/macierz",
        icon: "layers",
        sortOrder: 10,
        openInNewTab: false,
        isInternal: true,
      },
      {
        projectId: projectRecords.get("altcloud")!,
        label: "Skrzynka zespołowa AltCloud",
        url: "https://outlook.office.com/mail/",
        icon: "mail",
        sortOrder: 20,
        openInNewTab: true,
        isInternal: false,
      },
      {
        projectId: projectRecords.get("altcloud")!,
        label: "Kalendarz wdrożeń AltCloud",
        url: "https://calendar.google.com/",
        icon: "calendar",
        sortOrder: 30,
        openInNewTab: true,
        isInternal: false,
      },
      {
        projectId: projectRecords.get("beta")!,
        label: "Beta release checklist",
        url: "https://example.com/beta/release-checklist",
        icon: "check-circle",
        sortOrder: 10,
        openInNewTab: true,
        isInternal: false,
      },
      {
        projectId: projectRecords.get("beta")!,
        label: "Beta project home",
        url: "/",
        icon: "home",
        sortOrder: 20,
        openInNewTab: false,
        isInternal: true,
      },
    ],
  });

  await prisma.projectLink.deleteMany({
    where: {
      projectId: {
        in: projectIds,
      },
    },
  });

  await prisma.projectLink.createMany({
    data: [
      {
        projectId: projectRecords.get("altcloud")!,
        title: "AltCloud status board",
        url: "https://example.com/altcloud/status-board",
        description: "Operational dashboard used in the sample project environment.",
        icon: "bar-chart",
        sortOrder: 10,
        openInNewTab: true,
        isInternal: false,
      },
      {
        projectId: projectRecords.get("altcloud")!,
        title: "AltCloud knowledge shortcuts",
        url: "/baza-wiedzy",
        description: "Internal route to the shared knowledge base surface.",
        icon: "library",
        sortOrder: 20,
        openInNewTab: false,
        isInternal: true,
      },
      {
        projectId: projectRecords.get("altcloud")!,
        title: "AltCloud team mailbox",
        url: "https://outlook.office.com/mail/",
        description: "Shared team mailbox for the sample migrated project.",
        icon: "mail",
        sortOrder: 30,
        openInNewTab: true,
        isInternal: false,
      },
      {
        projectId: projectRecords.get("beta")!,
        title: "Beta project handbook",
        url: "https://example.com/beta/handbook",
        description: "Reference guide for the beta sample project.",
        icon: "book-open",
        sortOrder: 10,
        openInNewTab: true,
        isInternal: false,
      },
      {
        projectId: projectRecords.get("beta")!,
        title: "Beta landing page",
        url: "/",
        description: "Internal landing page for validating routed links.",
        icon: "home",
        sortOrder: 20,
        openInNewTab: false,
        isInternal: true,
      },
    ],
  });

  await prisma.projectKnowledgeArticle.deleteMany({
    where: {
      projectId: {
        in: projectIds,
      },
    },
  });

  await prisma.projectKnowledgeCategory.deleteMany({
    where: {
      projectId: {
        in: projectIds,
      },
    },
  });

  await prisma.projectKnowledgeCategory.createMany({
    data: [
      {
        id: "knowledge-cat-operations",
        projectId: projectRecords.get("altcloud")!,
        slug: "obsluga-klienta",
        name: "Obsługa klienta",
        description: "Safe sample category showing mixed article and subcategory ordering.",
        parentId: null,
        sortOrder: 0,
        childOrder: [
          "knowledge-article-first-contact",
          "knowledge-cat-operations-escalations",
        ],
      },
      {
        id: "knowledge-cat-billing",
        projectId: projectRecords.get("altcloud")!,
        slug: "rozliczenia",
        name: "Rozliczenia",
        description: "Sample project-scoped billing knowledge slice for development verification.",
        parentId: null,
        sortOrder: 1,
        childOrder: ["knowledge-article-meter-reading"],
      },
      {
        id: "beta-knowledge-cat-release",
        projectId: projectRecords.get("beta")!,
        slug: "release-playbook",
        name: "Release playbook",
        description: "Minimal locked-project knowledge sample.",
        parentId: null,
        sortOrder: 0,
        childOrder: ["beta-knowledge-article-release-check"],
      },
    ],
  });

  await prisma.projectKnowledgeCategory.createMany({
    data: [
      {
        id: "knowledge-cat-operations-escalations",
        projectId: projectRecords.get("altcloud")!,
        slug: "eskalacje",
        name: "Eskalacje",
        description: "Second-level category used to validate persisted sidebar child order.",
        parentId: "knowledge-cat-operations",
        sortOrder: 0,
        childOrder: ["knowledge-article-discount-escalation"],
      },
    ],
  });

  await prisma.projectKnowledgeArticle.createMany({
    data: [
      {
        id: "knowledge-article-first-contact",
        projectId: projectRecords.get("altcloud")!,
        categoryId: "knowledge-cat-operations",
        slug: "checklista-pierwszego-kontaktu",
        title: "Checklista pierwszego kontaktu",
        summary: "Krótka, bezpieczna próbka artykułu pokazująca backend-backed strukturę kategorii, sekcji i metadanych.",
        authorName: "AltCloud Operations",
        tags: ["start", "weryfikacja"],
        hiddenTags: [],
        matrixLinkId: null,
        globalMatrixLinkIds: [],
        keyDataPointsJson: [] as Prisma.InputJsonValue,
        quickActions: [
          "Potwierdź numer klienta",
          "Zapisz najważniejszy objaw w zgłoszeniu",
        ],
        externalSourceUrl: null,
        sectionSearchEnabled: true,
        sortOrder: 0,
      },
      {
        id: "knowledge-article-discount-escalation",
        projectId: projectRecords.get("altcloud")!,
        categoryId: "knowledge-cat-operations-escalations",
        slug: "eskalacja-rabatu-powitalnego",
        title: "Eskalacja rabatu powitalnego",
        summary: "Przykładowy artykuł w podkategorii do testów routingu i CRUD w trybie API.",
        authorName: "AltCloud Backoffice",
        tags: ["eskalacja"],
        hiddenTags: [],
        matrixLinkId: null,
        globalMatrixLinkIds: [],
        keyDataPointsJson: [] as Prisma.InputJsonValue,
        quickActions: ["Sprawdź historię decyzji promocyjnych"],
        externalSourceUrl: null,
        sectionSearchEnabled: false,
        sortOrder: 0,
      },
      {
        id: "knowledge-article-meter-reading",
        projectId: projectRecords.get("altcloud")!,
        categoryId: "knowledge-cat-billing",
        slug: "weryfikacja-odczytu-licznika",
        title: "Weryfikacja odczytu licznika",
        summary: "Próbka artykułu z linkiem zewnętrznym i sekcjami przechowywanymi relacyjnie.",
        authorName: "AltCloud Billing",
        tags: ["licznik", "rozliczenia"],
        hiddenTags: [],
        matrixLinkId: null,
        globalMatrixLinkIds: [],
        keyDataPointsJson: [] as Prisma.InputJsonValue,
        quickActions: ["Zweryfikuj zdjęcie licznika"],
        externalSourceUrl: "https://example.com/altcloud/meter-reading",
        sectionSearchEnabled: false,
        sortOrder: 0,
      },
      {
        id: "beta-knowledge-article-release-check",
        projectId: projectRecords.get("beta")!,
        categoryId: "beta-knowledge-cat-release",
        slug: "release-check-przed-publikacja",
        title: "Release check przed publikacją",
        summary: "Minimal sample article kept in the beta project to verify locked project reads.",
        authorName: "Beta Project",
        tags: ["release"],
        hiddenTags: [],
        matrixLinkId: null,
        globalMatrixLinkIds: [],
        keyDataPointsJson: [] as Prisma.InputJsonValue,
        quickActions: [],
        externalSourceUrl: null,
        sectionSearchEnabled: false,
        sortOrder: 0,
      },
    ],
  });

  await prisma.projectKnowledgeArticleSection.createMany({
    data: [
      {
        id: "knowledge-section-first-contact-scope",
        articleId: "knowledge-article-first-contact",
        sortOrder: 0,
        title: "Kiedy używać tej checklisty",
        tags: ["start"],
        collapsible: false,
        showSeparator: true,
        bodyJson: knowledgeDoc("Użyj tej checklisty przy każdym nowym kontakcie, zanim sprawa zostanie przypisana do dalszej obsługi."),
      },
      {
        id: "knowledge-section-first-contact-steps",
        articleId: "knowledge-article-first-contact",
        sortOrder: 1,
        title: "Kroki obowiązkowe",
        tags: ["weryfikacja"],
        collapsible: false,
        showSeparator: true,
        bodyJson: knowledgeDoc("Potwierdź dane klienta, zapisz objaw i wybierz najkrótszą ścieżkę przekazania zgodnie z aktualnym procesem."),
      },
      {
        id: "knowledge-section-discount-escalation-trigger",
        articleId: "knowledge-article-discount-escalation",
        sortOrder: 0,
        title: "Warunek eskalacji",
        tags: ["eskalacja"],
        collapsible: false,
        showSeparator: true,
        bodyJson: knowledgeDoc("Eskaluj tylko wtedy, gdy w historii klienta widoczna jest aktywna decyzja promocyjna wymagająca ręcznego potwierdzenia."),
      },
      {
        id: "knowledge-section-meter-reading-input",
        articleId: "knowledge-article-meter-reading",
        sortOrder: 0,
        title: "Dane wejściowe",
        tags: ["licznik"],
        collapsible: false,
        showSeparator: true,
        bodyJson: knowledgeDoc("Do weryfikacji odczytu potrzebny jest numer PPE, data odczytu oraz zdjęcie licznika, jeśli klient je posiada."),
      },
      {
        id: "knowledge-section-meter-reading-follow-up",
        articleId: "knowledge-article-meter-reading",
        sortOrder: 1,
        title: "Dalsze kroki",
        tags: ["rozliczenia"],
        collapsible: true,
        showSeparator: true,
        bodyJson: knowledgeDoc("Jeżeli dane są niespójne, przekaż sprawę do zespołu rozliczeń i dołącz komplet materiałów źródłowych."),
      },
      {
        id: "beta-knowledge-section-release-check",
        articleId: "beta-knowledge-article-release-check",
        sortOrder: 0,
        title: "Sample step",
        tags: ["release"],
        collapsible: false,
        showSeparator: true,
        bodyJson: knowledgeDoc("Verify that locked-project preview still serves backend-backed knowledge content to authorized members only."),
      },
    ],
  });

  await prisma.projectAnnouncement.deleteMany({
    where: {
      projectId: {
        in: projectIds,
      },
    },
  });

  await prisma.projectAnnouncement.createMany({
    data: [
      {
        projectId: projectRecords.get("altcloud")!,
        title: "Planned platform maintenance",
        bodyJson: {
          type: "doc",
          content: [
            {
              type: "paragraph",
              content: [
                {
                  type: "text",
                  text: "A routine maintenance window is scheduled for the sample project environment tonight between 20:00 and 21:00.",
                },
              ],
            },
          ],
        },
        description: "Routine maintenance window for the sample project environment.",
        color: "blue",
        active: true,
        sortOrder: 10,
        visibleFrom: new Date("2026-05-01T18:00:00.000Z"),
        visibleUntil: new Date("2026-05-31T21:00:00.000Z"),
      },
      {
        projectId: projectRecords.get("altcloud")!,
        title: "Month-end content freeze reminder",
        bodyJson: {
          type: "doc",
          content: [
            {
              type: "paragraph",
              content: [
                {
                  type: "text",
                  text: "Please pause non-urgent content publishing during the sample month-end close period unless a project admin approves the change.",
                },
              ],
            },
          ],
        },
        description: "Pause non-urgent content publishing during the sample month-end close period.",
        color: "orange",
        active: true,
        sortOrder: 20,
        visibleFrom: new Date("2026-05-20T08:00:00.000Z"),
        visibleUntil: null,
      },
      {
        projectId: projectRecords.get("beta")!,
        title: "Beta release rehearsal",
        bodyJson: {
          type: "doc",
          content: [
            {
              type: "paragraph",
              content: [
                {
                  type: "text",
                  text: "The beta project keeps one sample announcement to verify project-scoped read and locked-project behavior.",
                },
              ],
            },
          ],
        },
        description: "Sample beta-project announcement used for development verification.",
        color: "green",
        active: true,
        sortOrder: 10,
        visibleFrom: null,
        visibleUntil: null,
      },
    ],
  });

  await prisma.projectContact.deleteMany({
    where: {
      projectId: {
        in: projectIds,
      },
    },
  });

  await prisma.projectContact.createMany({
    data: [
      {
        id: "contact-support-desk",
        projectId: projectRecords.get("altcloud")!,
        title: "Support desk",
        description: "Primary first-line support contact for the sample project.",
        phone: "+48 800 100 100",
        email: "support.desk@example.com",
        address: "Sample Operations Center\n20 Example Street\n00-100 Warsaw",
        group: "zewnetrzne",
        sortOrder: 10,
      },
      {
        id: "contact-project-admin",
        projectId: projectRecords.get("altcloud")!,
        title: "Project administration",
        description: "Administrative coordination contact for access and process questions.",
        phone: "+48 800 200 200",
        email: "project.admin@example.com",
        group: "wewnetrzne",
        sortOrder: 20,
      },
      {
        id: "contact-field-operations",
        projectId: projectRecords.get("altcloud")!,
        title: "Field operations coverage",
        description: "Sample structured contact showing the existing detail table behavior.",
        detailTableJson: {
          title: "Coverage by operating area",
          sectionHeader: "Area",
          itemsHeader: "Region",
          actionHeader: "Contact path",
          sections: [
            {
              id: "north",
              label: "North region",
              groups: [
                {
                  id: "north-core",
                  items: "Gdansk\nGdynia\nSopot",
                  action: "Use the field operations hotline at +48 800 300 300.",
                },
              ],
            },
            {
              id: "south",
              label: "South region",
              groups: [
                {
                  id: "south-core",
                  items: "Krakow\nKatowice",
                  action: "Escalate by email to field.ops@example.com.",
                },
              ],
            },
          ],
          notes: "Generic sample detail table for development verification.",
        },
        group: "wewnetrzne",
        sortOrder: 30,
      },
    ],
  });

  await prisma.projectCommunication.deleteMany({
    where: {
      projectId: {
        in: projectIds,
      },
      kind: CommunicationKind.organizational_topic,
    },
  });

  await prisma.projectCommunication.createMany({
    data: [
      {
        id: "important-topic-shift-handoff",
        projectId: projectRecords.get("altcloud")!,
        kind: CommunicationKind.organizational_topic,
        title: "Shift handoff checklist refresh",
        bodyJson: {
          type: "doc",
          content: [
            {
              type: "paragraph",
              content: [
                {
                  type: "text",
                  text: "The sample project now expects the updated handoff checklist to be reviewed before each late shift starts.",
                },
              ],
            },
          ],
        },
        status: "active",
        communicationDate: new Date("2026-05-21T00:00:00.000Z"),
      },
      {
        id: "important-topic-support-floor",
        projectId: projectRecords.get("altcloud")!,
        kind: CommunicationKind.organizational_topic,
        title: "Support floor seating update",
        bodyJson: {
          type: "doc",
          content: [
            {
              type: "paragraph",
              content: [
                {
                  type: "text",
                  text: "Temporary seating changes remain in place through the end of the sprint while the sample operations area is reconfigured.",
                },
              ],
            },
          ],
        },
        status: "active",
        communicationDate: new Date("2026-05-18T00:00:00.000Z"),
      },
      {
        id: "important-topic-archive-example",
        projectId: projectRecords.get("altcloud")!,
        kind: CommunicationKind.organizational_topic,
        title: "Archived launch preparation note",
        bodyJson: {
          type: "doc",
          content: [
            {
              type: "paragraph",
              content: [
                {
                  type: "text",
                  text: "This archived sample entry exists to validate historical filtering and editor behavior for the module migration.",
                },
              ],
            },
          ],
        },
        status: "archived",
        communicationDate: new Date("2026-04-30T00:00:00.000Z"),
      },
    ],
  });

  await prisma.projectTemplate.deleteMany({
    where: {
      projectId: {
        in: projectIds,
      },
    },
  });

  await prisma.projectTemplate.createMany({
    data: [
      {
        id: "template-acknowledgement",
        projectId: projectRecords.get("altcloud")!,
        title: "Potwierdzenie przyjęcia zgłoszenia",
        channel: "email",
        bodyJson: {
          type: "doc",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "Dzień dobry," }],
            },
            {
              type: "paragraph",
              content: [
                {
                  type: "text",
                  text: "potwierdzamy przyjęcie zgłoszenia nr [NUMER_ZGŁOSZENIA]. Sprawa została przekazana do realizacji i wrócimy z aktualizacją do [TERMIN].",
                },
              ],
            },
            {
              type: "paragraph",
              content: [{ type: "text", text: "Pozdrawiamy," }],
            },
            {
              type: "paragraph",
              content: [{ type: "text", text: "Zespół AltCloud" }],
            },
          ],
        },
        exampleJson: {
          type: "doc",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "Dzień dobry," }],
            },
            {
              type: "paragraph",
              content: [
                {
                  type: "text",
                  text: "potwierdzamy przyjęcie zgłoszenia nr ALT-2048. Sprawa została przekazana do realizacji i wrócimy z aktualizacją do 29.05.2026 r.",
                },
              ],
            },
            {
              type: "paragraph",
              content: [{ type: "text", text: "Pozdrawiamy," }],
            },
            {
              type: "paragraph",
              content: [{ type: "text", text: "Zespół AltCloud" }],
            },
          ],
        },
        sortOrder: 10,
      },
      {
        id: "template-missing-input",
        projectId: projectRecords.get("altcloud")!,
        title: "Prośba o doprecyzowanie danych wejściowych",
        channel: "email",
        bodyJson: {
          type: "doc",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "Dzień dobry," }],
            },
            {
              type: "paragraph",
              content: [
                {
                  type: "text",
                  text: "aby dokończyć analizę zgłoszenia, potrzebujemy jeszcze następujących informacji:",
                },
              ],
            },
            {
              type: "bulletList",
              content: [
                {
                  type: "listItem",
                  content: [
                    {
                      type: "paragraph",
                      content: [{ type: "text", text: "[BRAKUJĄCY_ZAKRES]" }],
                    },
                  ],
                },
                {
                  type: "listItem",
                  content: [
                    {
                      type: "paragraph",
                      content: [{ type: "text", text: "[PRZYKŁADOWE_DANE_LUB_ZRZUT]" }],
                    },
                  ],
                },
              ],
            },
          ],
        },
        exampleJson: {
          type: "doc",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "Dzień dobry," }],
            },
            {
              type: "paragraph",
              content: [
                {
                  type: "text",
                  text: "aby dokończyć analizę zgłoszenia, potrzebujemy jeszcze następujących informacji:",
                },
              ],
            },
            {
              type: "bulletList",
              content: [
                {
                  type: "listItem",
                  content: [
                    {
                      type: "paragraph",
                      content: [{ type: "text", text: "numer klienta, którego dotyczy problem" }],
                    },
                  ],
                },
                {
                  type: "listItem",
                  content: [
                    {
                      type: "paragraph",
                      content: [{ type: "text", text: "zrzut ekranu z komunikatem błędu" }],
                    },
                  ],
                },
              ],
            },
          ],
        },
        sortOrder: 20,
      },
      {
        id: "template-second-line-handoff",
        projectId: projectRecords.get("altcloud")!,
        title: "Przekazanie sprawy do drugiej linii",
        channel: "zgloszenie",
        bodyJson: {
          type: "doc",
          content: [
            {
              type: "paragraph",
              content: [
                {
                  type: "text",
                  text: "Proszę o analizę zgłoszenia [NUMER_ZGŁOSZENIA]. Wstępna weryfikacja po stronie pierwszej linii została zakończona.",
                },
              ],
            },
            {
              type: "bulletList",
              content: [
                {
                  type: "listItem",
                  content: [
                    {
                      type: "paragraph",
                      content: [{ type: "text", text: "objawy: [OPIS_OBJAWÓW]" }],
                    },
                  ],
                },
                {
                  type: "listItem",
                  content: [
                    {
                      type: "paragraph",
                      content: [{ type: "text", text: "wykonane kroki: [WYKONANE_KROKI]" }],
                    },
                  ],
                },
              ],
            },
          ],
        },
        exampleJson: {
          type: "doc",
          content: [
            {
              type: "paragraph",
              content: [
                {
                  type: "text",
                  text: "Proszę o analizę zgłoszenia ALT-2055. Wstępna weryfikacja po stronie pierwszej linii została zakończona.",
                },
              ],
            },
            {
              type: "bulletList",
              content: [
                {
                  type: "listItem",
                  content: [
                    {
                      type: "paragraph",
                      content: [{ type: "text", text: "objawy: brak synchronizacji statusów po imporcie" }],
                    },
                  ],
                },
                {
                  type: "listItem",
                  content: [
                    {
                      type: "paragraph",
                      content: [{ type: "text", text: "wykonane kroki: odtworzono błąd na danych testowych i wykluczono problem z uprawnieniami" }],
                    },
                  ],
                },
              ],
            },
          ],
        },
        sortOrder: 30,
      },
    ],
  });

  await prisma.projectCommunication.deleteMany({
    where: {
      projectId: {
        in: projectIds,
      },
      kind: CommunicationKind.communication,
    },
  });

  await prisma.projectCommunication.createMany({
    data: [
      {
        id: "communication-altcloud-mobile-app",
        projectId: projectRecords.get("altcloud")!,
        kind: CommunicationKind.communication,
        title: "Aktualizacja aplikacji mobilnej AltCloud",
        status: "active",
        communicationDate: new Date("2026-05-24T00:00:00.000Z"),
        bodyJson: {
          type: "doc",
          content: [
            {
              type: "paragraph",
              content: [
                {
                  type: "text",
                  text: "Od 24.05.2026 r. nowa wersja aplikacji mobilnej wymaga aktualizacji po stronie użytkowników pracujących na urządzeniach prywatnych.",
                },
              ],
            },
            {
              type: "paragraph",
              content: [
                {
                  type: "text",
                  text: "W przypadku pytań konsultant powinien najpierw potwierdzić wersję systemu i aplikacji przed przekazaniem sprawy dalej.",
                },
              ],
            },
            {
              type: "bulletList",
              content: [
                {
                  type: "listItem",
                  content: [
                    {
                      type: "paragraph",
                      content: [{ type: "text", text: "iOS: wspierane od wersji 15" }],
                    },
                  ],
                },
                {
                  type: "listItem",
                  content: [
                    {
                      type: "paragraph",
                      content: [{ type: "text", text: "Android: wspierane od wersji 8.0" }],
                    },
                  ],
                },
              ],
            },
          ],
        },
      },
      {
        id: "communication-altcloud-weekend-window",
        projectId: projectRecords.get("altcloud")!,
        kind: CommunicationKind.communication,
        title: "Weekendowe okno serwisowe w kanale samoobsługowym",
        status: "active",
        communicationDate: new Date("2026-05-18T00:00:00.000Z"),
        bodyJson: {
          type: "doc",
          content: [
            {
              type: "paragraph",
              content: [
                {
                  type: "text",
                  text: "W sobotę od 22:00 do 23:30 planowane jest krótkie okno serwisowe dla samoobsługi klienta i kanałów powiązanych.",
                },
              ],
            },
            {
              type: "paragraph",
              content: [
                {
                  type: "text",
                  text: "W tym czasie konsultanci powinni korzystać z komunikatu zastępczego i przekazywać klientom orientacyjny czas przywrócenia dostępności usługi.",
                },
              ],
            },
          ],
        },
      },
      {
        id: "communication-altcloud-archive-example",
        projectId: projectRecords.get("altcloud")!,
        kind: CommunicationKind.communication,
        title: "Archiwalna procedura informowania o zmianach taryfowych",
        status: "archived",
        communicationDate: new Date("2026-04-30T00:00:00.000Z"),
        bodyJson: {
          type: "doc",
          content: [
            {
              type: "paragraph",
              content: [
                {
                  type: "text",
                  text: "Ta archiwalna pozycja pozostaje w seedzie po to, aby zweryfikować filtrowanie i historyczny widok komunikatów po migracji backendowej.",
                },
              ],
            },
          ],
        },
      },
    ],
  });

  await prisma.projectMatrixEntry.deleteMany({
    where: {
      projectId: {
        in: projectIds,
      },
    },
  });

  await prisma.projectMatrixEntry.createMany({
    data: [
      {
        id: "matrix-altcloud-missing-invoice",
        projectId: projectRecords.get("altcloud")!,
        category: "Reklamacje",
        subcategory: "Brak faktury",
        keywords: ["reklamacja", "brak faktury", "faktura"],
        description:
          "Klient zgłasza brak wystawionej faktury po zamknięciu okresu rozliczeniowego i wymaga ręcznej weryfikacji dekretacji.",
        slaDays: 14,
        instructions:
          "Zweryfikuj okres rozliczeniowy i status wystawienia dokumentu w systemie billingowym przed przekazaniem sprawy.",
        additionalNotes:
          "Jeżeli klient zgłasza mikroinstalację, potwierdź status OZE przed ostateczną dekretacją.",
        defaultDepartment: "",
        conditionsJson: [
          {
            department: "Zespół Reklamacji Klientów Indywidualnych",
            criteria: [{ field: "Typ Klienta", value: "Bez OZE" }],
          },
          {
            department: "Zespół Obsługi Małego Biznesu i Prosumentów",
            criteria: [{ field: "Typ Klienta", value: "Ma OZE" }],
          },
        ] as Prisma.InputJsonValue,
        linkedTemplateIds: ["template-acknowledgement"],
        sortOrder: 0,
      },
      {
        id: "matrix-altcloud-meter-seal",
        projectId: projectRecords.get("altcloud")!,
        category: "Zgłoszenia techniczne",
        subcategory: "Oplombowanie licznika",
        keywords: ["oplombowanie", "licznik", "plomba"],
        description:
          "Zgłoszenie plombowania lub ponownego plombowania jednego PPE z obsługą standardowego formularza.",
        slaDays: 30,
        instructions:
          "Potwierdź poprawność danych PPE i kompletność formularza przed przekazaniem do realizacji.",
        additionalNotes: "Wymagany kompletny opis zgłoszenia zgodny z szablonem operacyjnym.",
        defaultDepartment: "Automatyzacja Procesów Biznesowych",
        conditionsJson: [] as Prisma.InputJsonValue,
        linkedTemplateIds: ["template-second-line-handoff"],
        sortOrder: 0,
      },
      {
        id: "matrix-altcloud-collection-call",
        projectId: projectRecords.get("altcloud")!,
        category: "Płatności i rozliczenia",
        subcategory: "Windykacja po wpłacie klienta",
        keywords: ["windykacja", "wpłata", "wezwanie do zapłaty"],
        description:
          "Klient potwierdza opłacenie należności, ale nadal otrzymał monit lub wezwanie do zapłaty.",
        slaDays: 7,
        instructions:
          "Zweryfikuj ostatnie zaksięgowanie wpłaty i kanał wpływu zgłoszenia przed skierowaniem sprawy do odpowiedniego zespołu.",
        additionalNotes: "Dla regionów specjalnych stosuj właściwy wariant obszaru w kryteriach.",
        defaultDepartment: "Zespół Rozliczeń Specjalnych",
        conditionsJson: [
          {
            department: "Windykacja Region Zachód",
            criteria: [{ field: "Obszar", value: "Poznań / Szamotuły / Opalenica" }],
          },
          {
            department: "Windykacja Region Pomorze",
            criteria: [{ field: "Obszar", value: "Bydgoszcz" }],
          },
        ] as Prisma.InputJsonValue,
        linkedTemplateIds: ["template-missing-input"],
        sortOrder: 0,
      },
    ],
  });

  await prisma.projectPhrase.deleteMany({
    where: {
      projectId: {
        in: projectIds,
      },
    },
  });

  await prisma.projectPhrase.createMany({
    data: [
      {
        projectId: projectRecords.get("altcloud")!,
        title: "Weryfikacja adresu e-mail do eBOK",
        content:
          "Potwierdzę adres e-mail, który będzie używany do logowania w eBOK. Proszę podać go powoli, litera po literze, abym mógł poprawnie wprowadzić dane.",
        requiresConfirmation: true,
        sortOrder: 10,
      },
      {
        projectId: projectRecords.get("altcloud")!,
        title: "Informacja o terminie realizacji zgłoszenia",
        content:
          "Zgłoszenie zostało przyjęte do realizacji. Jeżeli po weryfikacji będą potrzebne dodatkowe informacje, skontaktujemy się z Panem/Panią w ramach tego samego numeru sprawy.",
        requiresConfirmation: false,
        sortOrder: 20,
      },
      {
        projectId: projectRecords.get("altcloud")!,
        title: "Zgoda na kontakt w sprawie oferty",
        content:
          "Czy wyraża Pan/Pani zgodę na kontakt telefoniczny w sprawie oferty przygotowanej przez nasz zespół? Proszę o jednoznaczne potwierdzenie odpowiedzi TAK albo NIE.",
        requiresConfirmation: true,
        sortOrder: 30,
      },
    ],
  });

  await prisma.projectPricingDocument.deleteMany({
    where: {
      projectId: {
        in: projectIds,
      },
    },
  });

  await prisma.projectPricingDocument.createMany({
    data: [
      {
        id: "pricing-altcloud-energy-standard",
        projectId: projectRecords.get("altcloud")!,
        title: "Cennik energii elektrycznej dla taryf domowych",
        subtitle: "Zestawienie przykładowych stawek G11, G12 i G12w",
        provider: "AltCloud Energia",
        effectiveFrom: new Date("2026-01-01T00:00:00.000Z"),
        status: PricingStatus.active,
        footnotes: [
          "Przykładowe dane seedowe do weryfikacji migracji modułu pricing.",
          "Wartości mają charakter techniczny i nie reprezentują oferty handlowej.",
        ],
        sectionsJson: [
          {
            type: "table",
            id: "pricing-table-energy",
            title: "Cena energii czynnej",
            description: "Przykładowe stawki energii w zależności od wariantu taryfy.",
            unit: "zł/kWh",
            columns: [
              { key: "g11", label: "Całodobowa" },
              { key: "g12_peak", label: "Szczytowa" },
              { key: "g12_offpeak", label: "Pozaszczytowa" },
            ],
            rows: [
              {
                id: "pricing-row-g11",
                label: "Oferta standardowa",
                symbol: "G11",
                values: {
                  g11: "0,6421",
                  g12_peak: "0,6421",
                  g12_offpeak: "0,6421",
                },
              },
              {
                id: "pricing-row-g12",
                label: "Dwustrefowa",
                symbol: "G12",
                values: {
                  g11: "0,0000",
                  g12_peak: "0,7810",
                  g12_offpeak: "0,4190",
                },
              },
            ],
            footnotes: ["Wartości brutto, łącznie z podatkiem VAT."],
          },
        ] as Prisma.InputJsonValue,
      },
      {
        id: "pricing-altcloud-distribution-g1x",
        projectId: projectRecords.get("altcloud")!,
        title: "Opłaty dystrybucyjne dla grup taryfowych G1x",
        provider: "AltCloud Operator",
        effectiveFrom: new Date("2026-02-01T00:00:00.000Z"),
        status: PricingStatus.active,
        footnotes: [
          "Przykładowy dokument seedowy z sekcją wariantową i tabelaryczną.",
        ],
        sectionsJson: [
          {
            type: "charges",
            id: "pricing-charges-network",
            title: "Opłata stała sieciowa",
            description: "Miesięczna stawka zależna od taryfy i wariantu zasilania.",
            items: [
              {
                id: "pricing-charge-fixed-network",
                name: "Opłata stała sieciowa",
                unit: "zł/msc",
                variants: [
                  { id: "pricing-charge-fixed-network-g11", conditions: "G11", value: "10,40" },
                  { id: "pricing-charge-fixed-network-g12", conditions: "G12", value: "12,70" },
                  { id: "pricing-charge-fixed-network-g12w", conditions: "G12w", value: "14,10" },
                ],
              },
              {
                id: "pricing-charge-quality",
                name: "Opłata jakościowa",
                unit: "zł/kWh",
                variants: [
                  { id: "pricing-charge-quality-all", conditions: "Wszystkie taryfy G1x", value: "0,0415" },
                ],
              },
            ],
          },
          {
            type: "table",
            id: "pricing-table-capacity",
            title: "Opłata mocowa",
            unit: "zł/msc",
            columns: [
              { key: "band_a", label: "< 500 kWh" },
              { key: "band_b", label: "500 - 1200 kWh" },
              { key: "band_c", label: "> 1200 kWh" },
            ],
            rows: [
              {
                id: "pricing-row-capacity",
                label: "Stawka miesięczna",
                values: {
                  band_a: "4,52",
                  band_b: "10,81",
                  band_c: "16,28",
                },
              },
            ],
          },
        ] as Prisma.InputJsonValue,
      },
      {
        id: "pricing-beta-reference",
        projectId: projectRecords.get("beta")!,
        title: "Beta pricing reference",
        subtitle: "Locked-project sample used for read access verification",
        provider: "Beta Energy",
        effectiveFrom: new Date("2026-03-01T00:00:00.000Z"),
        status: PricingStatus.archived,
        footnotes: ["Sample archived pricing document for locked project scenarios."],
        sectionsJson: [
          {
            type: "table",
            id: "pricing-beta-table",
            title: "Reference energy price",
            unit: "EUR/MWh",
            columns: [
              { key: "single", label: "Single band" },
            ],
            rows: [
              {
                id: "pricing-beta-row",
                label: "Reference value",
                values: {
                  single: "118,50",
                },
              },
            ],
          },
        ] as Prisma.InputJsonValue,
      },
    ],
  });

  await prisma.uploadPolicy.deleteMany({
    where: {
      OR: [
        {
          projectId: {
            in: projectIds,
          },
        },
        {
          projectId: null,
          mediaKind: {
            in: [MediaKind.image, MediaKind.file, MediaKind.video],
          },
        },
      ],
    },
  });

  await prisma.uploadPolicy.createMany({
    data: [
      {
        projectId: null,
        mediaKind: MediaKind.image,
        maxBytes: BigInt(5 * 1024 * 1024),
        allowedMimePatterns: ["image/*"],
      },
      {
        projectId: null,
        mediaKind: MediaKind.file,
        maxBytes: BigInt(10 * 1024 * 1024),
        allowedMimePatterns: ["application/*", "text/*"],
      },
      {
        projectId: null,
        mediaKind: MediaKind.video,
        maxBytes: BigInt(500 * 1024 * 1024),
        allowedMimePatterns: ["video/*"],
      },
    ],
  });

  console.log(
    `Seeded ${users.length} users, ${projects.length} projects, 5 memberships, 17 project modules, 5 project quick links, 5 project links, 4 knowledge categories, 4 knowledge articles, 5 knowledge article sections, 3 project announcements, 3 project communications, 3 project organizational topics, 3 project contacts, 3 project templates, 3 project matrix entries, 3 project phrases, 3 project pricing documents, and 3 upload policies.`
  );
}

main()
  .catch((error) => {
    console.error("Seed failed.", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });