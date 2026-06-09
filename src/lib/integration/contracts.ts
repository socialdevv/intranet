export type IntegrationOutcome =
  | "success"
  | "warning"
  | "fallback"
  | "failure"
  | "not-configured";

export type SaveContractCode =
  | "saved-local"
  | "saved-memory-only"
  | "saved-api"
  | "saved-local-fallback"
  | "saved-local-unconfigured"
  | "save-failed";

export type UploadContractCode =
  | "uploaded-api"
  | "not-configured"
  | "http-error"
  | "invalid-response"
  | "network";

export type IdentityContractCode =
  | "identity-resolved"
  | "identity-pin-mode"
  | "identity-header-unavailable"
  | "identity-whoami-not-configured"
  | "identity-whoami-http-error"
  | "identity-whoami-invalid-response"
  | "identity-whoami-network-error"
  | "identity-role-missing";

export type IntegrationCapabilityState = "configured" | "not-configured";

export type IntegrationCapabilityReasonCode =
  | "api-ready"
  | "storage-mode-local"
  | "api-base-url-missing";

export type IntegrationCapabilityDetails = {
  state: IntegrationCapabilityState;
  reasonCode: IntegrationCapabilityReasonCode;
};

export function resolveApiCapabilityDetails(
  storageMode: "file-local" | "api-assisted",
  apiConfigured: boolean
): IntegrationCapabilityDetails {
  if (storageMode === "file-local") {
    return {
      state: "not-configured",
      reasonCode: "storage-mode-local",
    };
  }

  if (!apiConfigured) {
    return {
      state: "not-configured",
      reasonCode: "api-base-url-missing",
    };
  }

  return {
    state: "configured",
    reasonCode: "api-ready",
  };
}
