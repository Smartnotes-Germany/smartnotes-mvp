export type PostHogEnvironment = "development" | "preview" | "production";
export type PostHogAppArea = "app" | "website";
export type PostHogIdentityQuality = "anonymous" | "email" | "app_only";

const LOCALHOST_HOSTNAMES = new Set(["localhost", "127.0.0.1", "::1"]);
const SMARTNOTES_PRODUCTION_DOMAIN = "smartnotes.tech";
const VERCEL_PREVIEW_DOMAIN = ".vercel.app";

export const resolvePostHogEnvironment = (
  hostname: string,
  isDevelopmentMode: boolean,
): PostHogEnvironment => {
  const normalizedHostname = hostname.trim().toLowerCase();

  if (
    isDevelopmentMode ||
    LOCALHOST_HOSTNAMES.has(normalizedHostname) ||
    normalizedHostname.endsWith(".localhost")
  ) {
    return "development";
  }

  if (
    normalizedHostname === SMARTNOTES_PRODUCTION_DOMAIN ||
    normalizedHostname.endsWith(`.${SMARTNOTES_PRODUCTION_DOMAIN}`)
  ) {
    return "production";
  }

  if (normalizedHostname.endsWith(VERCEL_PREVIEW_DOMAIN)) {
    return "preview";
  }

  return "preview";
};

// We only set an explicit cookie domain in production, where the website and
// app live under the same parent domain and should share the browser identity.
export const resolvePostHogCookieDomain = (hostname: string) => {
  const normalizedHostname = hostname.trim().toLowerCase();

  if (
    normalizedHostname === SMARTNOTES_PRODUCTION_DOMAIN ||
    normalizedHostname.endsWith(`.${SMARTNOTES_PRODUCTION_DOMAIN}`)
  ) {
    return `.${SMARTNOTES_PRODUCTION_DOMAIN}`;
  }

  return undefined;
};

export const getIdentityQuality = (args: {
  identityEmail?: string;
}): Exclude<PostHogIdentityQuality, "anonymous"> =>
  args.identityEmail ? "email" : "app_only";

// We persist the first-touch UTM set for the current browser session so later
// app events can still be attributed after navigation inside the SPA.
export const extractUtmProperties = (searchParams: URLSearchParams) => {
  const utmSource = searchParams.get("utm_source")?.trim();
  const utmMedium = searchParams.get("utm_medium")?.trim();
  const utmCampaign = searchParams.get("utm_campaign")?.trim();
  const utmTerm = searchParams.get("utm_term")?.trim();
  const utmContent = searchParams.get("utm_content")?.trim();

  return {
    ...(utmSource ? { utm_source: utmSource } : {}),
    ...(utmMedium ? { utm_medium: utmMedium } : {}),
    ...(utmCampaign ? { utm_campaign: utmCampaign } : {}),
    ...(utmTerm ? { utm_term: utmTerm } : {}),
    ...(utmContent ? { utm_content: utmContent } : {}),
  };
};
