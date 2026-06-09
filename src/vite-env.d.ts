/// <reference types="vite/client" />

declare const __APP_VERSION__: string;

interface ImportMetaEnv {
	readonly VITE_ALTCLOUD_PLATFORM_DATA_SOURCE?: "legacy-json" | "api";
	readonly VITE_ALTCLOUD_API_BASE_URL?: string;
	readonly VITE_ALTCLOUD_API_DEV_USER_EMAIL?: string;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}
