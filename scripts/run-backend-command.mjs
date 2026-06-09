import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SUPPORTED_NODE_MAJORS = new Set([20, 22]);

function getNodeMajor(version) {
  const major = Number.parseInt(version.split(".", 1)[0] ?? "", 10);
  return Number.isInteger(major) ? major : null;
}

function printUnsupportedNodeError() {
  console.error(
    [
      `Unsupported Node runtime ${process.version}.`,
      "The backend stack in this repo currently supports Node 20 and Node 22.",
      "Fastify v5 is not validated on Node 24 here and crashes before the server can boot.",
      "Switch to Node 22 (recommended) or Node 20, then rerun this command.",
    ].join("\n")
  );
}

const command = process.argv[2];
const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const nodeMajor = getNodeMajor(process.versions.node);

if (nodeMajor === null || !SUPPORTED_NODE_MAJORS.has(nodeMajor)) {
  printUnsupportedNodeError();
  process.exit(1);
}

let childArgs;

switch (command) {
  case "dev": {
    const tsxCliPath = resolve(rootDir, "node_modules", "tsx", "dist", "cli.mjs");
    childArgs = [tsxCliPath, "watch", "server/src/index.ts"];
    break;
  }
  case "start":
    childArgs = [resolve(rootDir, "server", "dist", "index.js")];
    break;
  default:
    console.error(`Unknown backend command: ${command ?? "(missing)"}`);
    process.exit(1);
}

const child = spawn(process.execPath, childArgs, {
  cwd: rootDir,
  env: process.env,
  stdio: "inherit",
});

child.on("error", (error) => {
  console.error("Failed to launch backend command.", error);
  process.exit(1);
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 1);
});