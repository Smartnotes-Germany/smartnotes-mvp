const normalizeWhitespace = (value: string) =>
  value.trim().replace(/\s+/g, " ");

export const normalizeIdentityLabel = (value: string) =>
  normalizeWhitespace(value).normalize("NFKC");

export const normalizeIdentityEmail = (value: string) =>
  normalizeWhitespace(value).toLowerCase();

const slugifyIdentityLabel = (value: string) =>
  normalizeIdentityLabel(value)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");

export const buildIdentityKey = (args: {
  identityLabel: string;
  identityEmail?: string;
}) => {
  const identityEmail = args.identityEmail
    ? normalizeIdentityEmail(args.identityEmail)
    : "";

  if (identityEmail) {
    return `email:${identityEmail}`;
  }

  const normalizedLabel = slugifyIdentityLabel(args.identityLabel);
  return `label:${normalizedLabel}`;
};

export const buildPostHogDistinctId = (identityKey: string) =>
  `smartnotes-user:${identityKey}`;
