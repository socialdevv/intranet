import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { GlobalRole, PrismaClient, ProjectRole } from "@prisma/client";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app.js";
import type { AppEnv } from "../src/config/env.js";
import { ensureMediaStorageDirectories } from "../src/lib/media-storage.js";
import { DEV_USER_HEADER_NAME } from "../src/lib/platform-bootstrap.js";

const prisma = new PrismaClient();
const TEST_PREFIX = "itest-hardening";
const BASE_PROJECT_SLUG = `${TEST_PREFIX}-base`;
const BASE_PROJECT_CODE = "ITESTHARDENBASE";
const SUPER_ADMIN_EMAIL = "itest.super.admin@intranet.local";
const CONTENT_MANAGER_EMAIL = "itest.content.manager@intranet.local";
const PROJECT_USER_EMAIL = "itest.project.user@intranet.local";

let app: FastifyInstance;

function createEnv(nodeEnv: AppEnv["NODE_ENV"]): AppEnv {
  return {
    NODE_ENV: nodeEnv,
    SERVER_HOST: "127.0.0.1",
    SERVER_PORT: 3199,
    LOG_LEVEL: "silent",
    DATABASE_URL: process.env.DATABASE_URL ?? "",
    CORS_ALLOWED_ORIGINS: "",
    MEDIA_STORAGE_ROOT: "./runtime-media",
  };
}

function headerFor(email: string) {
  return { [DEV_USER_HEADER_NAME]: email };
}

function randomSuffix() {
  return `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
}

async function ensureUser(input: {
  email: string;
  displayName: string;
  initials: string;
  globalRole: GlobalRole;
}) {
  const user = await prisma.user.upsert({
    where: { email: input.email },
    update: {
      displayName: input.displayName,
      initials: input.initials,
      globalRole: input.globalRole,
      status: "active",
    },
    create: {
      email: input.email,
      displayName: input.displayName,
      initials: input.initials,
      globalRole: input.globalRole,
      status: "active",
    },
    select: {
      id: true,
    },
  });

  return user.id;
}

async function ensureFixtureData() {
  const superAdminId = await ensureUser({
    email: SUPER_ADMIN_EMAIL,
    displayName: "Integration Super Admin",
    initials: "ISA",
    globalRole: GlobalRole.super_admin,
  });
  const contentManagerId = await ensureUser({
    email: CONTENT_MANAGER_EMAIL,
    displayName: "Integration Content Manager",
    initials: "ICM",
    globalRole: GlobalRole.user,
  });
  const projectUserId = await ensureUser({
    email: PROJECT_USER_EMAIL,
    displayName: "Integration Project User",
    initials: "IPU",
    globalRole: GlobalRole.user,
  });

  const project = await prisma.project.upsert({
    where: { slug: BASE_PROJECT_SLUG },
    update: {
      code: BASE_PROJECT_CODE,
      name: "Integration Hardening Base Project",
      description: "Fixture for API hardening integration tests.",
      isActive: true,
      isListed: true,
      sortOrder: 9800,
    },
    create: {
      slug: BASE_PROJECT_SLUG,
      code: BASE_PROJECT_CODE,
      name: "Integration Hardening Base Project",
      description: "Fixture for API hardening integration tests.",
      isActive: true,
      isListed: true,
      sortOrder: 9800,
    },
    select: {
      id: true,
    },
  });

  await prisma.projectMembership.upsert({
    where: {
      projectId_userId: {
        projectId: project.id,
        userId: superAdminId,
      },
    },
    update: { effectiveRole: ProjectRole.project_admin },
    create: {
      projectId: project.id,
      userId: superAdminId,
      effectiveRole: ProjectRole.project_admin,
    },
  });
  await prisma.projectMembership.upsert({
    where: {
      projectId_userId: {
        projectId: project.id,
        userId: contentManagerId,
      },
    },
    update: { effectiveRole: ProjectRole.content_manager },
    create: {
      projectId: project.id,
      userId: contentManagerId,
      effectiveRole: ProjectRole.content_manager,
    },
  });
  await prisma.projectMembership.upsert({
    where: {
      projectId_userId: {
        projectId: project.id,
        userId: projectUserId,
      },
    },
    update: { effectiveRole: ProjectRole.project_user },
    create: {
      projectId: project.id,
      userId: projectUserId,
      effectiveRole: ProjectRole.project_user,
    },
  });
}

async function cleanupTestProjects() {
  await prisma.project.deleteMany({
    where: {
      slug: {
        startsWith: TEST_PREFIX,
      },
    },
  });
}

type InjectResult<T = unknown> = {
  statusCode: number;
  body: T;
};

async function injectJson<T = unknown>(
  target: FastifyInstance,
  input: Parameters<FastifyInstance["inject"]>[0]
): Promise<InjectResult<T>> {
  const response = await target.inject(input);
  return {
    statusCode: response.statusCode,
    body: response.json() as T,
  };
}

before(async () => {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required for integration tests.");
  }

  await cleanupTestProjects();
  await ensureFixtureData();
  const env = createEnv("test");
  await ensureMediaStorageDirectories(env);
  app = buildApp(env);
  await app.ready();
});

after(async () => {
  await app.close();
  await cleanupTestProjects();
  await prisma.$disconnect();
});

test("quality hardening critical backend-backed flows", async (t) => {
  await t.test("project creation allows super admin and creates bootstrap data", async () => {
    const suffix = randomSuffix();
    const slug = `${TEST_PREFIX}-create-${suffix}`;
    const code = `ITEST-${Date.now()}`;
    const creation = await injectJson<{ data: { project: { id: string; slug: string; code: string } } }>(
      app,
      {
        method: "POST",
        url: "/api/v1/platform/projects",
        headers: headerFor(SUPER_ADMIN_EMAIL),
        payload: {
          slug,
          code: code.toLowerCase(),
          name: "Integration Created Project",
        },
      }
    );

    assert.equal(creation.statusCode, 201);
    assert.equal(creation.body.data.project.slug, slug);
    assert.equal(creation.body.data.project.code, code.toUpperCase());

    const [moduleCount, creatorMembership] = await Promise.all([
      prisma.projectModule.count({
        where: {
          projectId: creation.body.data.project.id,
        },
      }),
      prisma.projectMembership.findFirst({
        where: {
          projectId: creation.body.data.project.id,
          user: {
            email: SUPER_ADMIN_EMAIL,
          },
        },
        select: {
          effectiveRole: true,
        },
      }),
    ]);

    assert.ok(moduleCount > 0, "created project should receive default modules");
    assert.equal(creatorMembership?.effectiveRole, ProjectRole.project_admin);
  });

  await t.test("project creation forbids non-super-admin users", async () => {
    const suffix = randomSuffix();
    const response = await injectJson<{ error: { code: string } }>(app, {
      method: "POST",
      url: "/api/v1/platform/projects",
      headers: headerFor(CONTENT_MANAGER_EMAIL),
      payload: {
        slug: `${TEST_PREFIX}-forbidden-${suffix}`,
        code: `ITESTF${Date.now()}`,
        name: "Forbidden Project Creation",
      },
    });

    assert.equal(response.statusCode, 403);
    assert.equal(response.body.error.code, "PLATFORM_PROJECT_FORBIDDEN");
  });

  await t.test("project metadata mutation allows super admin and forbids other global roles", async () => {
    const forbidden = await injectJson<{ error: { code: string } }>(app, {
      method: "PATCH",
      url: `/api/v1/projects/${BASE_PROJECT_SLUG}`,
      headers: headerFor(CONTENT_MANAGER_EMAIL),
      payload: {
        slug: BASE_PROJECT_SLUG,
        code: BASE_PROJECT_CODE,
        name: "Should Be Forbidden",
      },
    });

    assert.equal(forbidden.statusCode, 403);
    assert.equal(forbidden.body.error.code, "PROJECT_ACCESS_FORBIDDEN");

    const allowed = await injectJson<{ data: { project: { name: string } } }>(app, {
      method: "PATCH",
      url: `/api/v1/projects/${BASE_PROJECT_SLUG}`,
      headers: headerFor(SUPER_ADMIN_EMAIL),
      payload: {
        slug: BASE_PROJECT_SLUG,
        code: BASE_PROJECT_CODE,
        name: "Integration Hardening Base Project Updated",
      },
    });

    assert.equal(allowed.statusCode, 200);
    assert.equal(allowed.body.data.project.name, "Integration Hardening Base Project Updated");
  });

  await t.test("project settings mutation allows project admin and forbids project user", async () => {
    const forbidden = await injectJson<{ error: { code: string } }>(app, {
      method: "PATCH",
      url: `/api/v1/projects/${BASE_PROJECT_SLUG}/modules/forms`,
      headers: headerFor(PROJECT_USER_EMAIL),
      payload: {
        enabled: false,
      },
    });

    assert.equal(forbidden.statusCode, 403);
    assert.equal(forbidden.body.error.code, "PROJECT_ACCESS_FORBIDDEN");

    const allowed = await injectJson(app, {
      method: "PATCH",
      url: `/api/v1/projects/${BASE_PROJECT_SLUG}/modules/forms`,
      headers: headerFor(SUPER_ADMIN_EMAIL),
      payload: {
        enabled: true,
      },
    });

    assert.equal(allowed.statusCode, 200);
    const formsModule = await prisma.projectModule.findFirst({
      where: {
        project: {
          slug: BASE_PROJECT_SLUG,
        },
        moduleKey: "forms",
      },
      select: {
        enabled: true,
      },
    });
    assert.equal(formsModule?.enabled, true);
  });

  await t.test("forms flow accepts valid submission and rejects invalid submission", async () => {
    const formSlug = `${TEST_PREFIX}-form-${randomSuffix()}`;
    const createForm = await injectJson<{ data: { item: { id: string } } }>(app, {
      method: "POST",
      url: `/api/v1/projects/${BASE_PROJECT_SLUG}/forms`,
      headers: headerFor(CONTENT_MANAGER_EMAIL),
      payload: {
        slug: formSlug,
        title: "Hardening Test Form",
        description: "Form used by integration smoke coverage.",
        isActive: true,
        fields: [
          {
            id: "full_name",
            label: "Full name",
            type: "text",
            required: true,
          },
        ],
      },
    });

    assert.equal(createForm.statusCode, 201);
    const formId = createForm.body.data.item.id;

    const validSubmit = await injectJson<{ data: { submission: { id: string } } }>(app, {
      method: "POST",
      url: `/api/v1/projects/${BASE_PROJECT_SLUG}/forms/${formId}/submissions`,
      headers: headerFor(PROJECT_USER_EMAIL),
      payload: {
        answers: {
          full_name: "Integration User",
        },
      },
    });

    assert.equal(validSubmit.statusCode, 201);
    assert.ok(validSubmit.body.data.submission.id);

    const invalidSubmit = await injectJson<{ error: { code: string; fieldErrors: Array<{ field: string }> } }>(
      app,
      {
        method: "POST",
        url: `/api/v1/projects/${BASE_PROJECT_SLUG}/forms/${formId}/submissions`,
        headers: headerFor(PROJECT_USER_EMAIL),
        payload: {
          answers: {},
        },
      }
    );

    assert.equal(invalidSubmit.statusCode, 400);
    assert.equal(invalidSubmit.body.error.code, "VALIDATION_ERROR");
    assert.ok(
      invalidSubmit.body.error.fieldErrors.some((entry) => entry.field.includes("answers.full_name")),
      "missing required field should produce validation error"
    );
  });

  await t.test("project audit visibility allows content manager and forbids project user", async () => {
    const allowed = await injectJson<{ data: { items: unknown[] } }>(app, {
      method: "GET",
      url: `/api/v1/projects/${BASE_PROJECT_SLUG}/audit?limit=10`,
      headers: headerFor(CONTENT_MANAGER_EMAIL),
    });

    assert.equal(allowed.statusCode, 200);
    assert.ok(Array.isArray(allowed.body.data.items));

    const forbidden = await injectJson<{ error: { code: string } }>(app, {
      method: "GET",
      url: `/api/v1/projects/${BASE_PROJECT_SLUG}/audit?limit=10`,
      headers: headerFor(PROJECT_USER_EMAIL),
    });

    assert.equal(forbidden.statusCode, 403);
    assert.equal(forbidden.body.error.code, "PROJECT_ACCESS_FORBIDDEN");
  });

  await t.test("dev header auth is blocked in production mode", async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";

    try {
      const productionEnv = createEnv("production");
      await ensureMediaStorageDirectories(productionEnv);
      const productionApp = buildApp(productionEnv);
      await productionApp.ready();

      const response = await injectJson<{ error: { code: string } }>(productionApp, {
        method: "GET",
        url: "/api/v1/platform/bootstrap",
        headers: headerFor(SUPER_ADMIN_EMAIL),
      });

      assert.equal(response.statusCode, 404);
      assert.equal(response.body.error.code, "DEV_USER_NOT_FOUND");
      await productionApp.close();
    } finally {
      process.env.NODE_ENV = originalNodeEnv;
    }
  });
});
