import { STORAGE_KEYS } from "./constants";

/**
 * Wer einen geteilten Link ohne Anmeldung öffnet, landet erst bei Clerk. Der
 * Link wird bis dahin gemerkt und danach wieder geöffnet.
 */
export const storePendingShareToken = (token: string) => {
  try {
    sessionStorage.setItem(STORAGE_KEYS.pendingShareToken, token);
  } catch {
    // Ohne Session Storage muss der Link nach der Anmeldung neu geöffnet werden.
  }
};

export const readPendingShareToken = () => {
  try {
    return sessionStorage.getItem(STORAGE_KEYS.pendingShareToken);
  } catch {
    return null;
  }
};

export const clearPendingShareToken = () => {
  try {
    sessionStorage.removeItem(STORAGE_KEYS.pendingShareToken);
  } catch {
    // Nichts zu tun.
  }
};
