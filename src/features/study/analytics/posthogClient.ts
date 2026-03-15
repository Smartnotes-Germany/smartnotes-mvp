import posthog, { type PostHogConfig } from "posthog-js";
import { resolvedFrontendEnv } from "../../../env";
import { buildPostHogDistinctId } from "../../../../shared/identity";

const SENSITIVE_SELECTOR = ".ph-no-capture, [data-ph-sensitive='true']";

let initialized = false;

const buildPostHogOptions = (): Partial<PostHogConfig> => {
  return {
    defaults: "2026-01-30",
    api_host: resolvedFrontendEnv.posthog.host,
    ui_host: resolvedFrontendEnv.posthog.uiHost,
    person_profiles: "identified_only",
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
      maskAllInputs: true,
      maskInputFn: () => "[MASKIERT]",
      maskTextFn: () => "[MASKIERT]",
    },
    persistence: "localStorage",
  };
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
  return true;
};

export const isPostHogEnabled = () => initialized;

export const posthogClient = posthog;

type AnalyticsIdentity = {
  identityKey: string;
  identityLabel: string;
  identityEmail?: string;
  note?: string;
};

type AnalyticsContext = {
  grantToken?: string | null;
  sessionId?: string | null;
};

export const identifyPostHogUser = (
  identity: AnalyticsIdentity,
  context?: AnalyticsContext,
) => {
  if (!isPostHogEnabled()) {
    return;
  }

  posthogClient.identify(buildPostHogDistinctId(identity.identityKey), {
    identityKey: identity.identityKey,
    identityLabel: identity.identityLabel,
    ...(identity.identityEmail
      ? {
          identityEmail: identity.identityEmail,
          $email: identity.identityEmail,
        }
      : {}),
    ...(identity.note ? { note: identity.note } : {}),
    $name: identity.identityLabel,
  });

  posthogClient.register({
    identityKey: identity.identityKey,
    identityLabel: identity.identityLabel,
    ...(identity.identityEmail
      ? { identityEmail: identity.identityEmail }
      : {}),
    ...(identity.note ? { note: identity.note } : {}),
    ...(context?.grantToken ? { grantToken: context.grantToken } : {}),
    ...(context?.sessionId ? { sessionId: context.sessionId } : {}),
  });
};

export const registerPostHogContext = (context: AnalyticsContext) => {
  if (!isPostHogEnabled()) {
    return;
  }

  posthogClient.register({
    ...(context.grantToken ? { grantToken: context.grantToken } : {}),
    ...(context.sessionId ? { sessionId: context.sessionId } : {}),
  });
};

export const resetPostHogUser = () => {
  if (!isPostHogEnabled()) {
    return;
  }

  posthogClient.reset();
};
