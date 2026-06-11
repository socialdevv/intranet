import assert from "node:assert/strict";
import { test } from "node:test";
import {
  AUDIT_LOG_RETENTION_DAYS,
  pruneExpiredAuditLogs,
  resolveAuditLogRetentionCutoff,
} from "../src/lib/audit-retention.js";

test("resolveAuditLogRetentionCutoff subtracts the configured retention window", () => {
  const now = new Date("2026-06-10T12:00:00.000Z");
  const cutoff = resolveAuditLogRetentionCutoff(now);

  assert.equal(cutoff.toISOString(), "2026-03-12T12:00:00.000Z");
  assert.equal(AUDIT_LOG_RETENTION_DAYS, 90);
});

test("pruneExpiredAuditLogs deletes rows older than the retention cutoff", async () => {
  const deletedIds: string[] = [];

  const prisma = {
    auditLog: {
      deleteMany: async ({ where }: { where: { occurredAt: { lt: Date } } }) => {
        assert.equal(where.occurredAt.lt.toISOString(), "2026-03-12T12:00:00.000Z");
        deletedIds.push("row");
        return { count: 1 };
      },
    },
  };

  const count = await pruneExpiredAuditLogs(
    prisma as never,
    {
      info: () => undefined,
      error: () => undefined,
      warn: () => undefined,
    } as never,
    new Date("2026-06-10T12:00:00.000Z")
  );

  assert.equal(count, 1);
  assert.deepEqual(deletedIds, ["row"]);
});
