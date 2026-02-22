import type { ThemePreference } from "./types";

export const STORAGE_KEYS = {
  grantToken: "smartnotes.grant-token",
  sessionId: "smartnotes.session-id",
  theme: "smartnotes.theme",
} as const;

export const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: "light", label: "Hell" },
  { value: "system", label: "System" },
  { value: "dark", label: "Dunkel" },
];

export const ACCEPTED_FILE_TYPES =
  ".pdf,.ppt,.pptx,.doc,.docx,.txt,.md,.markdown,.csv,.json,.jpg,.jpeg,.png,.webp";
