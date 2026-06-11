import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import { GlobalRole, PrismaClient, ProjectRole } from "@prisma/client";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app.js";
import type { AppEnv } from "../src/config/env.js";
import {
  FILE_MAX_BYTES,
  IMAGE_MAX_BYTES,
  VIDEO_LARGE_TIER_MAX_COUNT,
  VIDEO_SMALL_TIER_MAX_BYTES,
  VIDEO_SMALL_TIER_MAX_COUNT,
} from "../src/lib/project-upload-capacity.js";
import { DEV_USER_HEADER_NAME } from "../src/lib/platform-bootstrap.js";
import { ensureMediaStorageDirectories } from "../src/lib/media-storage.js";

const prisma = new PrismaClient();
const TEST_PREFIX = "itest-upload-capacity";
const PROJECT_SLUG = `${TEST_PREFIX}-project`;
const PROJECT_CODE = "ITESTUPLOADCAP";
const CONTENT_MANAGER_EMAIL = "itest.upload.manager@intranet.local";

let app: FastifyInstance;
let tempDir = "";
let projectId = "";

function createEnv(): AppEnv {
  return {
    NODE_ENV: "test",
    SERVER_HOST: "127.0.0.1",
    SERVER_PORT: 3197,
    LOG_LEVEL: "silent",
    DATABASE_URL: process.env.DATABASE_URL ?? "",
    CORS_ALLOWED_ORIGINS: "",
    RATE_LIMIT_MAX: 200,
    RATE_LIMIT_TIME_WINDOW: "1 minute",
    UPLOAD_MAX_FILE_SIZE_BYTES: 314_572_800,
    UPLOAD_RATE_LIMIT_MAX: 5,
    UPLOAD_RATE_LIMIT_TIME_WINDOW: "1 minute",
    ENABLE_SWAGGER: false,
    ENABLE_PREVIEW_AUTH: false,
    STATIC_WEB_ROOT: "",
    MEDIA_STORAGE_ROOT: tempDir,
  };
}

function buildMultipartPayload(input: {
  fields: Record<string, string>;
  file: {
    fieldName?: string;
    filename: string;
    contentType: string;
    content: Buffer;
  };
}): { payload: Buffer; headers: Record<string, string> } {
  const boundary = "----intranet-upload-test-boundary";
  const chunks: Buffer[] = [];

  for (const [name, value] of Object.entries(input.fields)) {
    chunks.push(
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`
      )
    );
  }

  const fieldName = input.file.fieldName ?? "file";
  chunks.push(
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="${fieldName}"; filename="${input.file.filename}"\r\nContent-Type: ${input.file.contentType}\r\n\r\n`
    )
  );
  chunks.push(input.file.content);
  chunks.push(Buffer.from(`\r\n--${boundary}--\r\n`));

  return {
    payload: Buffer.concat(chunks),
    headers: {
      "content-type": `multipart/form-data; boundary=${boundary}`,
    },
  };
}

async function createTempFile(name: string, sizeBytes: number): Promise<string> {
  const filePath = path.join(tempDir, name);
  await writeFile(filePath, Buffer.alloc(sizeBytes, 1));
  return filePath;
}

async function postUpload(multipart: ReturnType<typeof buildMultipartPayload>) {
  return app.inject({
    method: "POST",
    url: "/api/v1/uploads",
    headers: {
      [DEV_USER_HEADER_NAME]: CONTENT_MANAGER_EMAIL,
      ...multipart.headers,
    },
    payload: multipart.payload,
  });
}

async function ensureFixtureData() {
  const contentManagerId = await prisma.user.upsert({
    where: { email: CONTENT_MANAGER_EMAIL },
    update: {
      displayName: "Integration Upload Manager",
      initials: "IUM",
      globalRole: GlobalRole.user,
      status: "active",
    },
    create: {
      email: CONTENT_MANAGER_EMAIL,
      displayName: "Integration Upload Manager",
      initials: "IUM",
      globalRole: GlobalRole.user,
      status: "active",
    },
    select: { id: true },
  });

  const project = await prisma.project.upsert({
    where: { slug: PROJECT_SLUG },
    update: {
      code: PROJECT_CODE,
      name: "Integration Upload Capacity Project",
      description: "Fixture for upload tier capacity integration tests.",
      isActive: true,
      isListed: true,
      sortOrder: 9700,
    },
    create: {
      slug: PROJECT_SLUG,
      code: PROJECT_CODE,
      name: "Integration Upload Capacity Project",
      description: "Fixture for upload tier capacity integration tests.",
      isActive: true,
      isListed: true,
      sortOrder: 9700,
    },
    select: { id: true },
  });

  projectId = project.id;

  await prisma.projectMembership.upsert({
    where: {
      projectId_userId: {
        projectId: project.id,
        userId: contentManagerId.id,
      },
    },
    update: { effectiveRole: ProjectRole.content_manager },
    create: {
      projectId: project.id,
      userId: contentManagerId.id,
      effectiveRole: ProjectRole.content_manager,
    },
  });
}

async function cleanupFixtureData() {
  await prisma.project.deleteMany({
    where: {
      slug: {
        startsWith: TEST_PREFIX,
      },
    },
  });

  await prisma.user.deleteMany({
    where: {
      email: CONTENT_MANAGER_EMAIL,
    },
  });
}

before(async () => {
  tempDir = await mkdtemp(path.join(tmpdir(), "intranet-upload-capacity-"));
  await ensureFixtureData();
  const env = createEnv();
  await ensureMediaStorageDirectories(env);
  app = await buildApp(env);
  await app.ready();
});

after(async () => {
  await app.close();
  await cleanupFixtureData();
  await prisma.$disconnect();
  await rm(tempDir, { recursive: true, force: true });
});

test("upload rejects images above the 5MB per-kind limit with HTTP 400", async () => {
  const oversizeBytes = IMAGE_MAX_BYTES + 1;
  const filePath = await createTempFile("oversize-image.png", oversizeBytes);
  const fileContent = await readFile(filePath);
  const multipart = buildMultipartPayload({
    fields: {
      projectId,
      kind: "image",
      sizeBytes: String(oversizeBytes),
    },
    file: {
      filename: "oversize-image.png",
      contentType: "image/png",
      content: fileContent,
    },
  });

  const response = await postUpload(multipart);

  assert.equal(response.statusCode, 400);
  const body = JSON.parse(response.body) as { error: { code: string } };
  assert.equal(body.error.code, "UPLOAD_TOO_LARGE");
});

test("upload rejects documents above the 10MB per-kind limit with HTTP 400", async () => {
  const oversizeBytes = FILE_MAX_BYTES + 1;
  const filePath = await createTempFile("oversize-doc.pdf", oversizeBytes);
  const fileContent = await readFile(filePath);
  const multipart = buildMultipartPayload({
    fields: {
      projectId,
      kind: "file",
      sizeBytes: String(oversizeBytes),
    },
    file: {
      filename: "oversize-doc.pdf",
      contentType: "application/pdf",
      content: fileContent,
    },
  });

  const response = await postUpload(multipart);

  assert.equal(response.statusCode, 400);
  const body = JSON.parse(response.body) as { error: { code: string } };
  assert.equal(body.error.code, "UPLOAD_TOO_LARGE");
});

test("upload rejects videos above the 300MB per-kind limit with HTTP 400", async () => {
  const oversizeBytes = 314_572_801;
  const filePath = await createTempFile("oversize-video.mp4", 1024);
  const fileContent = await readFile(filePath);
  const multipart = buildMultipartPayload({
    fields: {
      projectId,
      kind: "video",
      sizeBytes: String(oversizeBytes),
    },
    file: {
      filename: "oversize-video.mp4",
      contentType: "video/mp4",
      content: fileContent,
    },
  });

  const response = await postUpload(multipart);

  assert.equal(response.statusCode, 400);
  const body = JSON.parse(response.body) as { error: { code: string } };
  assert.equal(body.error.code, "UPLOAD_TOO_LARGE");
});

test("upload rejects projects that exceed the small-video tier capacity", async () => {
  await prisma.auditLog.deleteMany({
    where: {
      projectId,
      entityType: "project_media_upload",
    },
  });

  for (let index = 0; index < VIDEO_SMALL_TIER_MAX_COUNT; index += 1) {
    await prisma.auditLog.create({
      data: {
        projectId,
        entityType: "project_media_upload",
        actionType: "create",
        metadataJson: {
          mediaKind: "video",
          sizeBytes: 1024,
          storedPath: `videos/${PROJECT_SLUG}/test-small-${index}.mp4`,
        },
      },
    });
  }

  const filePath = await createTempFile("small-video-overflow.mp4", 1024);
  const fileContent = await readFile(filePath);
  const multipart = buildMultipartPayload({
    fields: {
      projectId,
      kind: "video",
      sizeBytes: "1024",
    },
    file: {
      filename: "small-video-overflow.mp4",
      contentType: "video/mp4",
      content: fileContent,
    },
  });

  const response = await postUpload(multipart);

  assert.equal(response.statusCode, 400);
  const body = JSON.parse(response.body) as { error: { code: string; message: string } };
  assert.equal(body.error.code, "UPLOAD_CAPACITY_EXCEEDED");
  assert.match(body.error.message, /small videos/i);
});

test("upload rejects projects that exceed the large-video tier capacity", async () => {
  await prisma.auditLog.deleteMany({
    where: {
      projectId,
      entityType: "project_media_upload",
    },
  });

  for (let index = 0; index < VIDEO_LARGE_TIER_MAX_COUNT; index += 1) {
    await prisma.auditLog.create({
      data: {
        projectId,
        entityType: "project_media_upload",
        actionType: "create",
        metadataJson: {
          mediaKind: "video",
          sizeBytes: VIDEO_SMALL_TIER_MAX_BYTES + 1,
          storedPath: `videos/${PROJECT_SLUG}/test-large-${index}.mp4`,
        },
      },
    });
  }

  const filePath = await createTempFile("large-video-overflow.mp4", 1024);
  const fileContent = await readFile(filePath);
  const multipart = buildMultipartPayload({
    fields: {
      projectId,
      kind: "video",
      sizeBytes: String(VIDEO_SMALL_TIER_MAX_BYTES + 1),
    },
    file: {
      filename: "large-video-overflow.mp4",
      contentType: "video/mp4",
      content: fileContent,
    },
  });

  const response = await postUpload(multipart);

  assert.equal(response.statusCode, 400);
  const body = JSON.parse(response.body) as { error: { code: string; message: string } };
  assert.equal(body.error.code, "UPLOAD_CAPACITY_EXCEEDED");
  assert.match(body.error.message, /large videos/i);
});

test("document uploads are not blocked by video tier capacity limits", async () => {
  await prisma.auditLog.deleteMany({
    where: {
      projectId,
      entityType: "project_media_upload",
    },
  });

  for (let index = 0; index < VIDEO_SMALL_TIER_MAX_COUNT; index += 1) {
    await prisma.auditLog.create({
      data: {
        projectId,
        entityType: "project_media_upload",
        actionType: "create",
        metadataJson: {
          mediaKind: "video",
          sizeBytes: 1024,
          storedPath: `videos/${PROJECT_SLUG}/tier-blocker-${index}.mp4`,
        },
      },
    });
  }

  const filePath = await createTempFile("allowed-doc.pdf", 1024);
  const fileContent = await readFile(filePath);
  const multipart = buildMultipartPayload({
    fields: {
      projectId,
      kind: "file",
      sizeBytes: "1024",
    },
    file: {
      filename: "allowed-doc.pdf",
      contentType: "application/pdf",
      content: fileContent,
    },
  });

  const response = await postUpload(multipart);

  assert.equal(response.statusCode, 201);
});
