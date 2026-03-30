const normalizeWhitespace = (value: string) =>
  value.trim().replace(/\s+/g, " ");

const IDENTITY_LABEL_CONTENT_PATTERN = /[\p{L}\p{N}]/u;
const POSTHOG_DISTINCT_ID_PREFIX = "smartnotes-user:";

export const normalizeIdentityLabel = (value: string) =>
  normalizeWhitespace(value).normalize("NFKC");

export const normalizeIdentityEmail = (value: string) =>
  normalizeWhitespace(value).toLowerCase();

export const hasMeaningfulIdentityLabel = (value: string) =>
  IDENTITY_LABEL_CONTENT_PATTERN.test(normalizeIdentityLabel(value));

export const assertMeaningfulIdentityLabel = (value: string) => {
  const identityLabel = normalizeIdentityLabel(value);

  if (!identityLabel || !hasMeaningfulIdentityLabel(identityLabel)) {
    throw new Error(
      "Bitte gib eine Nutzerkennung mit mindestens einem Buchstaben oder einer Zahl an.",
    );
  }

  return identityLabel;
};

export const buildAnalyticsDistinctId = (args: {
  grantId: string;
  identityEmail?: string;
}) => {
  const identityEmail = args.identityEmail
    ? normalizeIdentityEmail(args.identityEmail)
    : "";

  if (identityEmail) {
    return `${POSTHOG_DISTINCT_ID_PREFIX}email:${identityEmail}`;
  }

  return `${POSTHOG_DISTINCT_ID_PREFIX}grant:${args.grantId}`;
};

export const buildSessionFallbackDistinctId = (sessionKey: string) =>
  `${POSTHOG_DISTINCT_ID_PREFIX}session-fallback:${sessionKey}`;
