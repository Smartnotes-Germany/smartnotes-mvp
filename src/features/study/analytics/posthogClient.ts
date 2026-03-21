import posthog, { type PostHogConfig } from "posthog-js";
import { resolvedFrontendEnv } from "../../../env";
import {
  extractUtmProperties,
  resolvePostHogCookieDomain,
  resolvePostHogEnvironment,
  type PostHogEnvironment,
  type PostHogIdentityQuality,
} from "../../../../shared/posthogRuntime";

const SENSITIVE_SELECTOR = ".ph-no-capture, [data-ph-sensitive='true']";
const INITIAL_ANALYTICS_CONTEXT_KEY = "smartnotes.posthog.initial-context.v1";

let initialized = false;

type AnalyticsPropertyValue = string | number | boolean | undefined;
type AnalyticsProperties = Record<string, AnalyticsPropertyValue>;
type InitialAnalyticsContext = {
  landingUrl: string;
  initialReferrer?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmTerm?: string;
  utmContent?: string;
};

type AnalyticsIdentity = {
  analyticsDistinctId: string;
  analyticsGrantId: string;
  identityLabel: string;
  identityQuality: Exclude<PostHogIdentityQuality, "anonymous">;
  identityEmail?: string;
  note?: string;
};

type AnalyticsContext = {
  analyticsGrantId?: string | null;
  sessionId?: string | null;
};

const normalizeAnalyticsProperties = (properties: AnalyticsProperties) =>
  Object.fromEntries(
    Object.entries(properties).filter(([, value]) => value !== undefined),
  );

const sanitizeAnalyticsUrl = (value?: string) => {
  if (!value) {
    return undefined;
  }

  try {
    const url = new URL(value);
    return `${url.origin}${url.pathname}`;
  } catch {
    return undefined;
  }
};

// The first-touch browser context should survive reloads within the current tab
// so later identified events still carry the original landing and UTM values.
const readInitialAnalyticsContext = (): InitialAnalyticsContext | null => {
  try {
    const rawValue = window.sessionStorage.getItem(
      INITIAL_ANALYTICS_CONTEXT_KEY,
    );
    if (!rawValue) {
      return null;
    }

    const parsed = JSON.parse(rawValue);
    if (!parsed || typeof parsed !== "object") {
      return null;
    }

    const context = parsed as InitialAnalyticsContext;
    return {
      ...context,
      landingUrl:
        sanitizeAnalyticsUrl(context.landingUrl) ??
        sanitizeAnalyticsUrl(window.location.href) ??
        `${window.location.origin}${window.location.pathname}`,
      initialReferrer: sanitizeAnalyticsUrl(context.initialReferrer),
    };
  } catch {
    return null;
  }
};

const writeInitialAnalyticsContext = (context: InitialAnalyticsContext) => {
  try {
    window.sessionStorage.setItem(
      INITIAL_ANALYTICS_CONTEXT_KEY,
      JSON.stringify(context),
    );
  } catch {
    // Session storage can fail in privacy-constrained browsers. Ignore.
  }
};

const getInitialAnalyticsContext = (): InitialAnalyticsContext => {
  const existingContext = readInitialAnalyticsContext();
  if (existingContext) {
    return existingContext;
  }

  const url = new URL(window.location.href);
  const utm = extractUtmProperties(url.searchParams);
  const sanitizedReferrer = sanitizeAnalyticsUrl(document.referrer);
  const context: InitialAnalyticsContext = {
    landingUrl: `${url.origin}${url.pathname}`,
    ...(sanitizedReferrer ? { initialReferrer: sanitizedReferrer } : {}),
    ...(utm.utm_source ? { utmSource: utm.utm_source } : {}),
    ...(utm.utm_medium ? { utmMedium: utm.utm_medium } : {}),
    ...(utm.utm_campaign ? { utmCampaign: utm.utm_campaign } : {}),
    ...(utm.utm_term ? { utmTerm: utm.utm_term } : {}),
    ...(utm.utm_content ? { utmContent: utm.utm_content } : {}),
  };

  writeInitialAnalyticsContext(context);
  return context;
};

const getBaseAnalyticsProperties = () => {
  const environment: PostHogEnvironment = resolvePostHogEnvironment(
    window.location.hostname,
    import.meta.env.DEV,
  );
  const initialContext = getInitialAnalyticsContext();
  const sanitizedReferrer = sanitizeAnalyticsUrl(document.referrer);

  return normalizeAnalyticsProperties({
    app_area: resolvedFrontendEnv.appArea,
    environment,
    source_surface: "client",
    host: window.location.host,
    path: window.location.pathname,
    referrer: sanitizedReferrer ?? initialContext.initialReferrer,
    landing_url: sanitizeAnalyticsUrl(initialContext.landingUrl),
    utm_source: initialContext.utmSource,
    utm_medium: initialContext.utmMedium,
    utm_campaign: initialContext.utmCampaign,
    utm_term: initialContext.utmTerm,
    utm_content: initialContext.utmContent,
  });
};

const buildPostHogOptions = (): Partial<PostHogConfig> => {
  const cookieDomain = resolvePostHogCookieDomain(window.location.hostname);

  return {
    defaults: "2026-01-30",
    api_host: resolvedFrontendEnv.posthog.host,
    ui_host: resolvedFrontendEnv.posthog.uiHost,
    person_profiles: "identified_only",
    persistence: "localStorage+cookie",
    ...(cookieDomain ? { cookie_domain: cookieDomain } : {}),
    capture_pageview: "history_change",
    capture_pageleave: true,
    capture_dead_clicks: true,
    capture_performance: {
      network_timing: true,
      web_vitals: true,
    },
    disable_session_recording: false,
    enable_recording_console_log: false,
    autocapture: {
      dom_event_allowlist: ["click", "change", "submit"],
      capture_copied_text: false,
      element_attribute_ignorelist: ["value", "placeholder", "aria-label"],
    },
    session_recording: {
      blockSelector: SENSITIVE_SELECTOR,
      maskTextSelector: SENSITIVE_SELECTOR,
      maskTextFn: () => "[MASKIERT]",
    },
  };
};

export const registerBaseContext = () => {
  if (!isPostHogEnabled()) {
    return;
  }

  // Keep route and referrer-style properties current for SPA navigation without
  // overwriting the user's identity state.
  posthogClient.register(getBaseAnalyticsProperties());
};

export const initializePostHog = () => {
  if (initialized) {
    return true;
  }

  const posthogKey = resolvedFrontendEnv.posthog.key;
  if (!posthogKey) {
    return false;
  }

  posthog.init(posthogKey, buildPostHogOptions());
  initialized = true;
  registerBaseContext();
  posthogClient.register({
    identity_quality: "anonymous",
  });
  return true;
};

export const isPostHogEnabled = () => initialized;

export const posthogClient = posthog;

export const identifyPostHogUser = (
  identity: AnalyticsIdentity,
  context?: AnalyticsContext,
) => {
  if (!isPostHogEnabled()) {
    return;
  }

  posthogClient.identify(identity.analyticsDistinctId, {
    ...getBaseAnalyticsProperties(),
    analyticsGrantId: identity.analyticsGrantId,
    identityLabel: identity.identityLabel,
    ...(identity.identityEmail
      ? {
          identityEmail: identity.identityEmail,
          email_normalized: identity.identityEmail,
          $email: identity.identityEmail,
        }
      : {}),
    ...(identity.note ? { note: identity.note } : {}),
    identity_quality: identity.identityQuality,
    $name: identity.identityLabel,
  });

  posthogClient.register({
    ...getBaseAnalyticsProperties(),
    analyticsGrantId: identity.analyticsGrantId,
    identityLabel: identity.identityLabel,
    ...(identity.identityEmail
      ? { identityEmail: identity.identityEmail }
      : {}),
    ...(identity.note ? { note: identity.note } : {}),
    identity_quality: identity.identityQuality,
    ...(context?.analyticsGrantId
      ? { analyticsGrantId: context.analyticsGrantId }
      : {}),
    ...(context?.sessionId ? { sessionId: context.sessionId } : {}),
  });
};

export const registerPostHogContext = (context: AnalyticsContext) => {
  if (!isPostHogEnabled()) {
    return;
  }

  posthogClient.register({
    ...getBaseAnalyticsProperties(),
    ...(context.analyticsGrantId
      ? { analyticsGrantId: context.analyticsGrantId }
      : {}),
    ...(context.sessionId ? { sessionId: context.sessionId } : {}),
  });
};

export const resetPostHogUser = () => {
  if (!isPostHogEnabled()) {
    return;
  }

  posthogClient.reset();
  posthogClient.register({
    ...getBaseAnalyticsProperties(),
    identity_quality: "anonymous",
  });
};
