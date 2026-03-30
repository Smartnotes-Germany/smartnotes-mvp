export const DEFAULT_POSTHOG_PROXY_PATH = "/snph";
export const DEFAULT_POSTHOG_INGEST_HOST = "https://eu.i.posthog.com";
export const DEFAULT_POSTHOG_ASSETS_HOST = "https://eu-assets.i.posthog.com";
export const DEFAULT_POSTHOG_UI_HOST = "https://eu.posthog.com";

export const normalizePostHogHost = (value: string) => {
  if (value.length > 1 && value.endsWith("/")) {
    return value.slice(0, -1);
  }

  return value;
};

export const isAbsoluteHttpUrl = (value: string) => {
  try {
    const parsedUrl = new URL(value);
    return parsedUrl.protocol === "http:" || parsedUrl.protocol === "https:";
  } catch {
    return false;
  }
};

export const isRelativeProxyPath = (value: string) =>
  value.startsWith("/") && value.length > 1;

export const isPostHogHostValue = (value: string) =>
  isAbsoluteHttpUrl(value) || isRelativeProxyPath(value);
