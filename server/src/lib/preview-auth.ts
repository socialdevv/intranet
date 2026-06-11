import { GlobalRole, type PrismaClient, UserStatus } from "@prisma/client";
import type { AppEnv } from "../config/env.js";
import { DEFAULT_DEV_USER_EMAIL } from "./platform-bootstrap-constants.js";

export const PREVIEW_AUTH_SECURITY_WARNING =
  "[SECURITY WARNING] Preview Authentication is ENABLED. Do not use this configuration in a live production environment!";

type PreviewAuthRuntimeEnv = Pick<AppEnv, "NODE_ENV" | "ENABLE_PREVIEW_AUTH">;

let runtimeAuthEnv: PreviewAuthRuntimeEnv | null = null;

export function configurePreviewAuth(env: PreviewAuthRuntimeEnv): void {
  runtimeAuthEnv = env;
}

export function isPreviewAuthEnabled(): boolean {
  if (runtimeAuthEnv) {
    return runtimeAuthEnv.ENABLE_PREVIEW_AUTH === true;
  }

  return process.env.ENABLE_PREVIEW_AUTH === "true";
}

/**
 * Header-based identity resolution is allowed outside production, or when preview auth
 * is explicitly enabled for pre-IdP container testing.
 */
export function isDevHeaderAuthEnabled(): boolean {
  if (isPreviewAuthEnabled()) {
    return true;
  }

  const nodeEnv = runtimeAuthEnv ? runtimeAuthEnv.NODE_ENV : process.env.NODE_ENV;
  return nodeEnv !== "production";
}

export async function resolveAuthFallbackEmail(prisma: PrismaClient): Promise<string> {
  if (isPreviewAuthEnabled()) {
    const configuredEmail =
      process.env.VITE_ALTCLOUD_API_DEV_USER_EMAIL?.trim() ||
      process.env.PREVIEW_AUTH_DEFAULT_USER_EMAIL?.trim();

    if (configuredEmail) {
      return configuredEmail;
    }

    const seededAdmin = await prisma.user.findFirst({
      where: {
        status: UserStatus.active,
        globalRole: GlobalRole.super_admin,
      },
      orderBy: {
        createdAt: "asc",
      },
      select: {
        email: true,
      },
    });

    if (seededAdmin?.email) {
      return seededAdmin.email;
    }
  }

  return DEFAULT_DEV_USER_EMAIL;
}
