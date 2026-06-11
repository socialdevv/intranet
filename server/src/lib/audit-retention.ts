import type { FastifyBaseLogger } from "fastify";
import type { PrismaClient } from "@prisma/client";

export const AUDIT_LOG_RETENTION_DAYS = 90;
const DAY_MS = 24 * 60 * 60 * 1000;

export function resolveAuditLogRetentionCutoff(now = new Date()): Date {
  return new Date(now.getTime() - AUDIT_LOG_RETENTION_DAYS * DAY_MS);
}

export async function pruneExpiredAuditLogs(
  prisma: PrismaClient,
  log: FastifyBaseLogger,
  now = new Date()
): Promise<number> {
  const cutoff = resolveAuditLogRetentionCutoff(now);

  const result = await prisma.auditLog.deleteMany({
    where: {
      occurredAt: {
        lt: cutoff,
      },
    },
  });

  log.info(
    {
      deletedCount: result.count,
      retentionDays: AUDIT_LOG_RETENTION_DAYS,
      cutoff: cutoff.toISOString(),
    },
    "Pruned expired audit log rows."
  );

  return result.count;
}
