export type ApiResponseMeta = {
  requestId: string;
  timestamp: string;
};

export type ApiFieldError = {
  field: string;
  code: string;
  message: string;
};

export type ApiSuccessEnvelope<T> = {
  data: T;
  meta: ApiResponseMeta;
};

export type ApiErrorEnvelope = {
  error: {
    code: string;
    message: string;
    details: Record<string, unknown>;
    fieldErrors: ApiFieldError[];
    retryable: boolean;
  };
  meta: ApiResponseMeta;
};

function buildMeta(requestId: string): ApiResponseMeta {
  return {
    requestId,
    timestamp: new Date().toISOString(),
  };
}

export function successEnvelope<T>(requestId: string, data: T): ApiSuccessEnvelope<T> {
  return {
    data,
    meta: buildMeta(requestId),
  };
}

export function errorEnvelope(
  requestId: string,
  input: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
    fieldErrors?: ApiFieldError[];
    retryable?: boolean;
  }
): ApiErrorEnvelope {
  return {
    error: {
      code: input.code,
      message: input.message,
      details: input.details ?? {},
      fieldErrors: input.fieldErrors ?? [],
      retryable: input.retryable ?? false,
    },
    meta: buildMeta(requestId),
  };
}
