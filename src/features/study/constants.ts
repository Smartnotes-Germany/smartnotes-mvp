import type { ThemePreference } from "./types";
import {
  ACCEPTED_FILE_TYPES,
  ACCEPTED_FILE_TYPES_LABEL,
  MAX_UPLOAD_FILE_BYTES,
  MAX_UPLOAD_FILE_LABEL,
} from "../../../shared/uploadPolicy";

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

export {
  ACCEPTED_FILE_TYPES,
  ACCEPTED_FILE_TYPES_LABEL,
  MAX_UPLOAD_FILE_BYTES,
  MAX_UPLOAD_FILE_LABEL,
};
