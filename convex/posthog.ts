"use node";

const DEFAULT_POSTHOG_HOST = "https://eu.i.posthog.com";
const CAPTURE_TIMEOUT_MS = 1_500;

type PostHogPrimitive = string | number | boolean;

type CapturePayload = {
  event: string;
  distinctId: string;
  properties: Record<string, PostHogPrimitive | PostHogPrimitive[] | undefined>;
};

type CaptureAiOperationPayload = {
  distinctId: string;
  traceId: string;
  scope: string;
  status: "success" | "error";
  latencyMs: number;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  llmAttempts?: number;
  fallbackUsed?: boolean;
  telemetryProvider?: "langfuse" | "none";
  privacyMode?: "balanced" | "full" | "off";
  documentIds?: string[];
  readyDocumentIds?: string[];
};

const asBoolean = (rawValue: string | undefined) => {
  if (!rawValue) {
    return false;
  }

  return ["1", "true", "yes", "on"].includes(rawValue.trim().toLowerCase());
};

const getPostHogConfig = () => {
  if (!asBoolean(process.env.POSTHOG_ENABLED)) {
    return null;
  }

  const projectKey = process.env.POSTHOG_PROJECT_KEY?.trim();
  if (!projectKey) {
    return null;
  }

  const rawHost = process.env.POSTHOG_HOST?.trim() || DEFAULT_POSTHOG_HOST;
  const host = rawHost.endsWith("/") ? rawHost.slice(0, -1) : rawHost;

  return {
    host,
    projectKey,
  };
};

const normalizePropertyArray = (values: string[] | undefined) => {
  if (!values || values.length === 0) {
    return undefined;
  }

  return values.map((value) => value.slice(0, 120)).slice(0, 50);
};

const capture = async (payload: CapturePayload) => {
  const config = getPostHogConfig();
  if (!config) {
    return;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort();
  }, CAPTURE_TIMEOUT_MS);

  try {
    const response = await fetch(`${config.host}/capture/`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      signal: controller.signal,
      body: JSON.stringify({
        api_key: config.projectKey,
        event: payload.event,
        distinct_id: payload.distinctId,
        properties: payload.properties,
      }),
    });

    if (!response.ok) {
      console.warn("[KI-Monitoring] PostHog-Capture fehlgeschlagen.", {
        event: payload.event,
        statusCode: response.status,
      });
    }
  } catch (error) {
    console.warn("[KI-Monitoring] PostHog-Capture nicht erfolgreich.", {
      event: payload.event,
      errorMessage: error instanceof Error ? error.message : String(error),
    });
  } finally {
    clearTimeout(timeout);
  }
};

export const captureAiOperationCompleted = async (
  payload: CaptureAiOperationPayload,
) => {
  const commonProperties = {
    traceId: payload.traceId,
    scope: payload.scope,
    status: payload.status,
    latencyMs: payload.latencyMs,
    inputTokens: payload.inputTokens,
    outputTokens: payload.outputTokens,
    totalTokens: payload.totalTokens,
    llmAttempts: payload.llmAttempts,
    fallbackUsed: payload.fallbackUsed,
    telemetryProvider: payload.telemetryProvider,
    privacyMode: payload.privacyMode,
    documentIds: normalizePropertyArray(payload.documentIds),
    readyDocumentIds: normalizePropertyArray(payload.readyDocumentIds),
  };

  await Promise.allSettled([
    capture({
      event: "ai_operation_completed",
      distinctId: payload.distinctId,
      properties: commonProperties,
    }),
    capture({
      event: "$ai_generation",
      distinctId: payload.distinctId,
      properties: {
        ...commonProperties,
        input: "[redacted]",
        output: "[redacted]",
      },
    }),
  ]);
};
