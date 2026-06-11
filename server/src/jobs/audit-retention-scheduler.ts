import type { FastifyInstance } from "fastify";
import { pruneExpiredAuditLogs } from "../lib/audit-retention.js";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export function startAuditRetentionScheduler(app: FastifyInstance): () => void {
  let interval: NodeJS.Timeout | null = null;
  let running = false;

  const runPrune = async (): Promise<void> => {
    if (!app.prisma) {
      app.log.warn("Audit retention prune skipped — Prisma client is not ready.");
      return;
    }

    if (running) {
      app.log.warn("Audit retention prune skipped — previous run still in progress.");
      return;
    }

    running = true;

    try {
      await pruneExpiredAuditLogs(app.prisma, app.log);
    } catch (error) {
      app.log.error({ err: error }, "Audit retention prune failed.");
    } finally {
      running = false;
    }
  };

  void runPrune();

  interval = setInterval(() => {
    void runPrune();
  }, WEEK_MS);
  interval.unref();

  app.log.info({ intervalDays: 7 }, "Audit retention scheduler started.");

  return () => {
    if (interval) {
      clearInterval(interval);
      interval = null;
    }
  };
}
