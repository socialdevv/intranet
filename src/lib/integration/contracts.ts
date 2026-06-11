export type IntegrationOutcome =
  | "success"
  | "warning"
  | "fallback"
  | "failure"
  | "not-configured";

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

export type IntegrationCapabilityReasonCode = "api-ready" | "api-base-url-missing";

export type IntegrationCapabilityDetails = {
  state: IntegrationCapabilityState;
  reasonCode: IntegrationCapabilityReasonCode;
};

export function resolveUploadCapabilityDetails(apiConfigured: boolean): IntegrationCapabilityDetails {
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
