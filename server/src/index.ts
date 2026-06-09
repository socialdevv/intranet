import { buildApp } from "./app.js";
import { env } from "./config/env.js";
import { ensureMediaStorageDirectories } from "./lib/media-storage.js";

await ensureMediaStorageDirectories(env);
const app = buildApp(env);

let shutdownStarted = false;

async function shutdown(signal: NodeJS.Signals): Promise<void> {
  if (shutdownStarted) {
    return;
  }

  shutdownStarted = true;
  app.log.info({ signal }, "Shutdown signal received.");

  try {
    await app.close();
    app.log.info("Server closed cleanly.");
    process.exit(0);
  } catch (error) {
    app.log.error({ err: error }, "Server shutdown failed.");
    process.exit(1);
  }
}

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    void shutdown(signal);
  });
}

try {
  await app.listen({
    host: env.SERVER_HOST,
    port: env.SERVER_PORT,
  });
} catch (error) {
  app.log.error({ err: error }, "Server startup failed.");
  process.exit(1);
}
