import type { BeforeSendFn, CaptureResult, Properties } from "posthog-js";

const SENSITIVE_KEY_PATTERNS = [
  /access.?code/i,
  /grant.?token/i,
  /magic.?link/i,
  /user.?answer/i,
  /answer.?text/i,
  /prompt/i,
  /extracted.?text/i,
  /document.?text/i,
  /secret/i,
  /password/i,
  /authorization/i,
  /cookie/i,
];

const HIGH_VOLUME_SAMPLE_RATES: Partial<Record<string, number>> = {
  $autocapture: 0.2,
  $rageclick: 0.5,
  $dead_click: 0.5,
  $web_vitals: 0.35,
  quiz_question_viewed: 0.75,
};

const shouldDropSensitiveEvent = (event: CaptureResult) => {
  if (event.event === "$copy_autocapture") {
    return true;
  }

  const eventElements = event.properties.$elements;
  if (!Array.isArray(eventElements)) {
    return false;
  }

  return eventElements.some((element) => {
    if (!element || typeof element !== "object") {
      return false;
    }

    const maybeClasses = (element as { attr_class?: unknown }).attr_class;
    if (!Array.isArray(maybeClasses)) {
      return false;
    }

    return maybeClasses.some(
      (entry) => typeof entry === "string" && entry.includes("ph-no-capture"),
    );
  });
};

const shouldSampleOut = (eventName: string) => {
  const sampleRate = HIGH_VOLUME_SAMPLE_RATES[eventName];
  if (sampleRate === undefined) {
    return false;
  }

  return Math.random() > sampleRate;
};

const isSensitiveKey = (key: string) => {
  return SENSITIVE_KEY_PATTERNS.some((pattern) => pattern.test(key));
};

const sanitizePropertyValue = (
  value: unknown,
): string | number | boolean | null => {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "string") {
    return value.length > 180 ? `${value.slice(0, 180)}…` : value;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  if (Array.isArray(value)) {
    const normalized = value
      .map((entry) => {
        if (typeof entry === "string") {
          return entry;
        }
        if (typeof entry === "number" || typeof entry === "boolean") {
          return String(entry);
        }
        return null;
      })
      .filter((entry): entry is string => Boolean(entry))
      .slice(0, 12);

    return normalized.join(",");
  }

  return "[object]";
};

const sanitizeProperties = (properties: Properties): Properties => {
  const sanitizedEntries = Object.entries(properties)
    .filter(([key]) => key !== "$elements" && !isSensitiveKey(key))
    .map(([key, value]) => [key, sanitizePropertyValue(value)] as const);

  return Object.fromEntries(sanitizedEntries);
};

export const createPostHogBeforeSend = (): BeforeSendFn => {
  return (captureResult) => {
    if (!captureResult) {
      return null;
    }

    if (shouldDropSensitiveEvent(captureResult)) {
      return null;
    }

    if (shouldSampleOut(captureResult.event)) {
      return null;
    }

    return {
      ...captureResult,
      properties: sanitizeProperties(captureResult.properties),
    };
  };
};
