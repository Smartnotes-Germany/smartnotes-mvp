"use node";

import { createHash } from "node:crypto";
import { LangfuseSpanProcessor } from "@langfuse/otel";
import { NodeSDK } from "@opentelemetry/sdk-node";
import {
  readBooleanEnv,
  readIntegerEnv,
  readOptionalEnv,
  readOptionalEnvFromAliases,
} from "./env";

const OBSERVABILITY_SCOPE = "smartnotes-observability";
const GLOBAL_STATE_KEY = Symbol.for("smartnotes.observability.state");
const DEFAULT_FLUSH_TIMEOUT_MS = 300;
const MIN_FLUSH_TIMEOUT_MS = 50;
const MAX_FLUSH_TIMEOUT_MS = 5_000;

type ObservabilityMode = "balanced" | "full" | "off";

type TelemetryMetadata = Record<string, string | number | boolean>;

type TelemetryConfig = {
  isEnabled: boolean;
  functionId: string;
  recordInputs?: boolean;
  recordOutputs?: boolean;
  metadata?: TelemetryMetadata;
};

type BuildTelemetryConfigArgs = {
  functionId: string;
  metadata?: Record<string, unknown>;
};

type ObservabilityGlobalState = {
  initialized: boolean;
  enabled: boolean;
  sdk?: NodeSDK;
  spanProcessor?: LangfuseSpanProcessor;
};

type FlushTelemetryOptions = {
  traceId?: string;
  appScope?: string;
};

type FlushTelemetryResult = {
  attempted: boolean;
  flushed: boolean;
  timedOut: boolean;
  elapsedMs: number;
  timeoutMs: number;
};

const getMode = (): ObservabilityMode => {
  const rawMode = readOptionalEnv("OBSERVABILITY_MODE")?.toLowerCase();
  if (rawMode === "off") {
    return "off";
  }
  if (rawMode === "full") {
    return "full";
  }
  return "balanced";
};

const isFlushOnExitEnabled = () => {
  if (process.env.OBSERVABILITY_FLUSH_ON_EXIT === undefined) {
    return true;
  }

  return readBooleanEnv("OBSERVABILITY_FLUSH_ON_EXIT");
};

const getFlushTimeoutMs = () => {
  return readIntegerEnv(
    "OBSERVABILITY_FLUSH_TIMEOUT_MS",
    DEFAULT_FLUSH_TIMEOUT_MS,
    {
      min: MIN_FLUSH_TIMEOUT_MS,
      max: MAX_FLUSH_TIMEOUT_MS,
    },
  );
};

const getGlobalState = (): ObservabilityGlobalState => {
  const globalObject = globalThis as typeof globalThis & {
    [GLOBAL_STATE_KEY]?: ObservabilityGlobalState;
  };

  if (!globalObject[GLOBAL_STATE_KEY]) {
    globalObject[GLOBAL_STATE_KEY] = {
      initialized: false,
      enabled: false,
    };
  }

  return globalObject[GLOBAL_STATE_KEY];
};

const hasLangfuseCredentials = () => {
  const publicKey = readOptionalEnv("LANGFUSE_PUBLIC_KEY");
  const secretKey = readOptionalEnv("LANGFUSE_SECRET_KEY");
  const baseUrl = readOptionalEnvFromAliases([
    "LANGFUSE_BASEURL",
    "LANGFUSE_BASE_URL",
  ]);
  return Boolean(publicKey && secretKey && baseUrl);
};

const applyLangfuseEnvironmentFallbacks = () => {
  if (!readOptionalEnv("LANGFUSE_BASEURL")) {
    const legacyBaseUrl = readOptionalEnv("LANGFUSE_BASE_URL");
    if (legacyBaseUrl) {
      process.env.LANGFUSE_BASEURL = legacyBaseUrl;
    }
  }
};

const normalizeTelemetryMetadataValue = (
  value: unknown,
): string | number | boolean | undefined => {
  if (value === null || value === undefined) {
    return undefined;
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
};

const sanitizeTelemetryMetadata = (
  metadata?: Record<string, unknown>,
): TelemetryMetadata | undefined => {
  if (!metadata) {
    return undefined;
  }

  const sanitizedEntries = Object.entries(metadata).flatMap(([key, value]) => {
    const normalizedValue = normalizeTelemetryMetadataValue(value);
    return normalizedValue === undefined
      ? []
      : [[key, normalizedValue] as const];
  });

  return Object.fromEntries(sanitizedEntries);
};

export const getObservabilityMode = () => getMode();

export const isSensitiveCaptureEnabled = () => {
  if (!readBooleanEnv("OBSERVABILITY_ALLOW_SENSITIVE_CAPTURE")) {
    return false;
  }

  const rawUntilTimestamp = readOptionalEnv(
    "OBSERVABILITY_SENSITIVE_CAPTURE_UNTIL",
  );
  if (!rawUntilTimestamp) {
    return true;
  }

  const untilTimestamp = Number.parseInt(rawUntilTimestamp, 10);
  if (!Number.isFinite(untilTimestamp)) {
    return true;
  }

  return Date.now() < untilTimestamp;
};

export const ensureTelemetryInitialized = () => {
  const state = getGlobalState();
  if (state.initialized) {
    return state.enabled;
  }

  state.initialized = true;

  if (getMode() === "off") {
    state.enabled = false;
    return false;
  }

  applyLangfuseEnvironmentFallbacks();

  if (!hasLangfuseCredentials()) {
    console.warn(
      "[KI-Monitoring] Langfuse ist nicht aktiv, da Konfigurationswerte fehlen.",
    );
    state.enabled = false;
    return false;
  }

  try {
    const spanProcessor = new LangfuseSpanProcessor();
    state.sdk = new NodeSDK({
      serviceName: OBSERVABILITY_SCOPE,
      spanProcessors: [spanProcessor],
    });
    state.spanProcessor = spanProcessor;

    void state.sdk.start();
    state.enabled = true;
  } catch (error) {
    console.warn(
      "[KI-Monitoring] OpenTelemetry-Initialisierung fehlgeschlagen.",
      error,
    );
    state.enabled = false;
  }

  return state.enabled;
};

export const getTelemetryProvider = (): "langfuse" | "none" => {
  return ensureTelemetryInitialized() ? "langfuse" : "none";
};

export const hashIdentifier = (
  rawValue: string | number | undefined | null,
) => {
  if (rawValue === undefined || rawValue === null) {
    return "";
  }

  const salt =
    readOptionalEnv("OBSERVABILITY_HASH_SALT") ?? "smartnotes-default-salt";
  return createHash("sha256")
    .update(`${salt}:${String(rawValue)}`)
    .digest("hex")
    .slice(0, 24);
};

export const redactTextForLog = (value: string | undefined | null) => {
  if (!value) {
    return {
      available: false,
      charCount: 0,
      sha256: null,
    };
  }

  return {
    available: true,
    charCount: value.length,
    sha256: createHash("sha256").update(value).digest("hex").slice(0, 16),
  };
};

export const buildTelemetryConfig = ({
  functionId,
  metadata,
}: BuildTelemetryConfigArgs): TelemetryConfig => {
  if (!ensureTelemetryInitialized()) {
    return {
      isEnabled: false,
      functionId,
    };
  }

  return {
    isEnabled: true,
    functionId,
    recordInputs: true,
    recordOutputs: true,
    metadata: {
      mode: getMode(),
      contentCaptured: true,
      ...(sanitizeTelemetryMetadata(metadata) ?? {}),
    },
  };
};

export const flushTelemetry = async (
  options?: FlushTelemetryOptions,
): Promise<FlushTelemetryResult> => {
  const timeoutMs = getFlushTimeoutMs();

  if (!isFlushOnExitEnabled()) {
    return {
      attempted: false,
      flushed: false,
      timedOut: false,
      elapsedMs: 0,
      timeoutMs,
    };
  }

  const state = getGlobalState();
  if (!state.initialized && !ensureTelemetryInitialized()) {
    return {
      attempted: false,
      flushed: false,
      timedOut: false,
      elapsedMs: 0,
      timeoutMs,
    };
  }

  if (!state.enabled || !state.spanProcessor) {
    return {
      attempted: false,
      flushed: false,
      timedOut: false,
      elapsedMs: 0,
      timeoutMs,
    };
  }

  const startedAt = Date.now();
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;

  try {
    await Promise.race([
      state.spanProcessor.forceFlush(),
      new Promise<never>((_, reject) => {
        timeoutHandle = setTimeout(() => {
          reject(new Error("flush_timeout"));
        }, timeoutMs);
      }),
    ]);

    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }

    return {
      attempted: true,
      flushed: true,
      timedOut: false,
      elapsedMs: Date.now() - startedAt,
      timeoutMs,
    };
  } catch (error) {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }

    const timedOut =
      error instanceof Error && error.message === "flush_timeout";
    console.warn(
      "[KI-Monitoring] Telemetrie-Flush war nicht vollständig erfolgreich.",
      {
        traceId: options?.traceId,
        appScope: options?.appScope,
        timedOut,
        timeoutMs,
        elapsedMs: Date.now() - startedAt,
        errorName: error instanceof Error ? error.name : undefined,
        errorMessage: error instanceof Error ? error.message : String(error),
      },
    );

    return {
      attempted: true,
      flushed: false,
      timedOut,
      elapsedMs: Date.now() - startedAt,
      timeoutMs,
    };
  }
};
