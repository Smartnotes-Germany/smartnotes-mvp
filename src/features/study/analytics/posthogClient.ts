import posthog, { type PostHogConfig } from "posthog-js";
import { resolvedFrontendEnv } from "../../../env";
import { createPostHogBeforeSend } from "./privacy";

const SENSITIVE_SELECTOR = ".ph-no-capture, [data-ph-sensitive='true']";

let initialized = false;

const buildPostHogOptions = (): Partial<PostHogConfig> => {
  return {
    defaults: "2026-01-30",
    api_host: resolvedFrontendEnv.posthog.host,
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
    before_send: createPostHogBeforeSend(),
    persistence: "memory",
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
