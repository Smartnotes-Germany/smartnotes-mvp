"use node";

import { readBooleanEnv, readOptionalEnv } from "./env";

const DEFAULT_POSTHOG_HOST = "https://eu.i.posthog.com";
const CAPTURE_TIMEOUT_MS = 1_500;

type PostHogPrimitive = string | number | boolean;
type PostHogPropertyValue = PostHogPrimitive | PostHogPrimitive[] | undefined;

type CapturePayload = {
  event: string;
  distinctId: string;
  properties: Record<string, PostHogPropertyValue>;
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
  modelId?: string;
  finishReason?: string;
  totalDocuments?: number;
  readyDocuments?: number;
  filePartCount?: number;
  sourceContextLength?: number;
  outputQuestionCount?: number;
  errorCategory?: string;
  errorName?: string;
  errorMessage?: string;
  errorStackPreview?: string;
  contentCaptured?: boolean;
  input?: string;
  output?: string;
  extraProperties?: Record<string, PostHogPropertyValue>;
};

const getPostHogConfig = () => {
  if (!readBooleanEnv("POSTHOG_ENABLED")) {
    return null;
  }

  const projectKey = readOptionalEnv("POSTHOG_PROJECT_KEY");
  if (!projectKey) {
    return null;
  }

  const rawHost = readOptionalEnv("POSTHOG_HOST") ?? DEFAULT_POSTHOG_HOST;
  const host = rawHost.endsWith("/") ? rawHost.slice(0, -1) : rawHost;

  return {
    host,
    projectKey,
  };
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
    documentIds: payload.documentIds,
    readyDocumentIds: payload.readyDocumentIds,
    modelId: payload.modelId,
    finishReason: payload.finishReason,
    totalDocuments: payload.totalDocuments,
    readyDocuments: payload.readyDocuments,
    filePartCount: payload.filePartCount,
    sourceContextLength: payload.sourceContextLength,
    outputQuestionCount: payload.outputQuestionCount,
    errorCategory: payload.errorCategory,
    errorName: payload.errorName,
    errorMessage: payload.errorMessage,
    errorStackPreview: payload.errorStackPreview,
    contentCaptured: payload.contentCaptured,
    ...payload.extraProperties,
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
        input: payload.input,
        output: payload.output,
      },
    }),
  ]);
};
