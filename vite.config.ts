import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import pkg from "./package.json";

function normalizeApiBaseUrl(baseUrl: string | undefined): string {
  return (baseUrl ?? "").trim().replace(/\/$/, "");
}

export default defineConfig(({ mode }) => {
  const loadedEnv = loadEnv(mode, process.cwd(), "");
  const apiBaseUrl = normalizeApiBaseUrl(
    process.env.VITE_ALTCLOUD_API_BASE_URL ?? loadedEnv.VITE_ALTCLOUD_API_BASE_URL
  );

  return {
    base: "./",
    define: {
      __APP_VERSION__: JSON.stringify(pkg.version),
    },
    plugins: [react(), tailwindcss()],
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes("node_modules")) return;
            if (id.includes("@tiptap")) return "tiptap";
            if (id.includes("lucide-react")) return "icons";
            return "vendor";
          },
        },
      },
    },
    server: apiBaseUrl
      ? {
          proxy: {
            "/api": {
              target: apiBaseUrl,
              changeOrigin: true,
            },
            "/photos": {
              target: apiBaseUrl,
              changeOrigin: true,
            },
            "/videos": {
              target: apiBaseUrl,
              changeOrigin: true,
            },
            "/files": {
              target: apiBaseUrl,
              changeOrigin: true,
            },
          },
        }
      : undefined,
    resolve: {
      alias: {
        "@": new URL("src", import.meta.url).pathname,
      },
    },
  };
});
