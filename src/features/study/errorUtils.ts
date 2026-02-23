import type { FormatErrorOptions } from "./types";

const ERROR_ID_PATTERN = /\[Fehler-ID:\s*([A-Z0-9-]+)\]/i;
const REQUEST_ID_PATTERN = /\[Request ID:\s*([^\]]+)\]/i;
const CLIENT_ERROR_ID_PREFIX = "SNCLIENT";
const CLIENT_REQUEST_ID_PREFIX = "SNREQ";

type ErrorReferences = {
  errorId: string | null;
  requestId: string | null;
  clientRequestId: string | null;
  clientErrorId: string | null;
};

const extractErrorId = (message: string) => {
  const match = message.match(ERROR_ID_PATTERN);
  return match?.[1] ?? null;
};

const extractRequestId = (message: string) => {
  const match = message.match(REQUEST_ID_PATTERN);
  return match?.[1]?.trim() ?? null;
};

const stripTrackingMetadata = (message: string) =>
  message.replace(ERROR_ID_PATTERN, "").replace(REQUEST_ID_PATTERN, "").trim();

const createClientErrorId = () => {
  const timestampPart = Date.now().toString(36).toUpperCase();
  const randomPart = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `${CLIENT_ERROR_ID_PREFIX}-${timestampPart}-${randomPart}`;
};

export const createClientRequestId = (scope: string) => {
  const scopeToken = scope
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 10);
  const timestampPart = Date.now().toString(36).toUpperCase();
  const randomPart = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `${CLIENT_REQUEST_ID_PREFIX}-${scopeToken || "REQ"}-${timestampPart}-${randomPart}`;
};

const isTransportError = (normalizedMessage: string) => {
  return (
    normalizedMessage.includes("connection lost while action was in flight") ||
    normalizedMessage.includes("network error") ||
    normalizedMessage.includes("failed to fetch") ||
    normalizedMessage.includes("load failed") ||
    normalizedMessage.includes("netzwerkfehler")
  );
};

const withErrorReferences = (message: string, references: ErrorReferences) => {
  const suffixParts: string[] = [];
  if (references.errorId) {
    suffixParts.push(`Fehler-ID: ${references.errorId}`);
  }
  if (references.requestId) {
    suffixParts.push(`Anfrage-ID: ${references.requestId}`);
  }
  if (references.clientRequestId) {
    suffixParts.push(`Vorgangs-ID: ${references.clientRequestId}`);
  }
  if (references.clientErrorId) {
    suffixParts.push(`Client-Fehler-ID: ${references.clientErrorId}`);
  }

  if (suffixParts.length === 0) {
    return message;
  }

  return `${message} (${suffixParts.join(", ")})`;
};

const extractReadableErrorMessage = (error: unknown) => {
  const rawMessage =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : String(error ?? "");

  if (!rawMessage.trim()) {
    return "";
  }

  const uncaughtMatch = rawMessage.match(/Uncaught Error:\s*([\s\S]+)/i);
  let cleanedMessage = uncaughtMatch?.[1]?.trim() ?? rawMessage.trim();

  cleanedMessage = cleanedMessage
    .replace(/\[CONVEX[^\]]*\]\s*/gi, "")
    .replace(/^Server Error\s*/i, "")
    .replace(/^Error:\s*/i, "")
    .trim();

  if (cleanedMessage.includes("\n")) {
    cleanedMessage =
      cleanedMessage
        .split("\n")
        .find((line) => line.trim().length > 0)
        ?.trim() ?? cleanedMessage;
  }

  return cleanedMessage;
};

export const formatError = (error: unknown, options?: FormatErrorOptions) => {
  const message = extractReadableErrorMessage(error);
  const errorId = extractErrorId(message);
  const requestId = extractRequestId(message);
  const clientRequestId = options?.clientRequestId ?? null;
  const cleanMessage = stripTrackingMetadata(message);
  const normalizedMessage = cleanMessage.toLowerCase();
  const clientErrorId =
    !errorId &&
    !requestId &&
    !clientRequestId &&
    isTransportError(normalizedMessage)
      ? createClientErrorId()
      : null;
  const references: ErrorReferences = {
    errorId,
    requestId,
    clientRequestId,
    clientErrorId,
  };

  if (clientErrorId) {
    console.error("[Client-Fehler-Tracking]", {
      clientErrorId,
      message: cleanMessage,
      rawError: error,
    });
  }

  if (
    !cleanMessage ||
    normalizedMessage === "undefined" ||
    normalizedMessage === "null"
  ) {
    return withErrorReferences(
      options?.fallback ??
        "Ein unerwarteter Fehler ist aufgetreten. Bitte versuche es später erneut.",
      references,
    );
  }

  if (
    normalizedMessage.includes("zu groß") ||
    normalizedMessage.includes("file too large") ||
    normalizedMessage.includes("payload too large") ||
    normalizedMessage.includes("entity too large") ||
    normalizedMessage.includes("maximal 7 mib")
  ) {
    return withErrorReferences(
      "Die Datei ist zu groß für die aktuelle Verarbeitung. Bitte verkleinere sie oder teile sie in mehrere Dateien auf.",
      references,
    );
  }

  if (
    normalizedMessage.includes("wird nicht unterstützt") ||
    normalizedMessage.includes("not supported") ||
    normalizedMessage.includes("unsupported")
  ) {
    return withErrorReferences(
      "Dieser Dateityp wird nicht unterstützt. Bitte nutze eines der erlaubten Formate.",
      references,
    );
  }

  if (isTransportError(normalizedMessage)) {
    return withErrorReferences(
      "Netzwerkfehler. Bitte prüfe deine Internetverbindung und versuche es erneut.",
      references,
    );
  }

  if (
    normalizedMessage.includes("timeout") ||
    normalizedMessage.includes("timed out") ||
    normalizedMessage.includes("zeitüberschreitung")
  ) {
    return withErrorReferences(
      "Die Anfrage hat zu lange gedauert. Bitte versuche es erneut.",
      references,
    );
  }

  if (
    normalizedMessage.includes("aborted") ||
    normalizedMessage.includes("abgebrochen")
  ) {
    return withErrorReferences(
      "Die Anfrage wurde abgebrochen. Bitte starte den Vorgang erneut.",
      references,
    );
  }

  if (
    normalizedMessage.includes("not recognized") ||
    normalizedMessage.includes("nicht erkannt")
  ) {
    return withErrorReferences(
      "Dieser Zugangscode ist ungültig. Bitte prüfe die Eingabe.",
      references,
    );
  }

  if (
    normalizedMessage.includes("already consumed") ||
    normalizedMessage.includes("bereits verwendet")
  ) {
    return withErrorReferences(
      "Dieser Code wurde bereits benutzt.",
      references,
    );
  }

  if (
    normalizedMessage.includes("invalid or expired") ||
    normalizedMessage.includes("ungültig oder abgelaufen")
  ) {
    return withErrorReferences(
      "Dein Link ist leider nicht mehr gültig.",
      references,
    );
  }

  if (
    normalizedMessage.includes("no unused access codes") ||
    normalizedMessage.includes("keine freien zugangscodes")
  ) {
    return withErrorReferences(
      "Aktuell sind keine freien Zugänge verfügbar.",
      references,
    );
  }

  const technicalErrorPattern =
    /\b(TypeError|ReferenceError|SyntaxError|RangeError|stack|cannot read)\b/i;
  if (!technicalErrorPattern.test(cleanMessage)) {
    return withErrorReferences(cleanMessage, references);
  }

  return withErrorReferences(
    options?.fallback ??
      "Ein unerwarteter Fehler ist aufgetreten. Bitte versuche es später erneut.",
    references,
  );
};
