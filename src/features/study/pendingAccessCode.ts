import { STORAGE_KEYS } from "./constants";

type PendingAccessCodeSource = "manual_code" | "magic_link";

type PendingAccessCode = {
  code: string;
  source: PendingAccessCodeSource;
};

/**
 * Merkt sich einen Zugangscode bis nach der Anmeldung. Danach löst
 * useAuthSession ihn automatisch ein.
 */
export const storePendingAccessCode = (
  code: string,
  source: PendingAccessCodeSource,
) => {
  try {
    if (code.trim()) {
      sessionStorage.setItem(
        STORAGE_KEYS.pendingAccessCode,
        JSON.stringify({ code, source } satisfies PendingAccessCode),
      );
    } else {
      sessionStorage.removeItem(STORAGE_KEYS.pendingAccessCode);
    }
  } catch {
    // Ohne Session Storage muss der Code von Hand eingegeben werden.
  }
};

/**
 * Magic Links enthalten den Zugangscode als `?code=`. Er wird vor dem Routing
 * gesichert, damit er die Weiterleitung zur Anmeldung übersteht.
 */
export const capturePendingAccessCode = () => {
  const url = new URL(window.location.href);
  const code = url.searchParams.get("code");
  if (!code) {
    return;
  }

  storePendingAccessCode(code, "magic_link");

  url.searchParams.delete("code");
  window.history.replaceState({}, document.title, url.toString());
};

export const readPendingAccessCode = (): PendingAccessCode | null => {
  try {
    const stored = sessionStorage.getItem(STORAGE_KEYS.pendingAccessCode);
    if (!stored) {
      return null;
    }

    const parsed: unknown = JSON.parse(stored);
    if (
      parsed &&
      typeof parsed === "object" &&
      "code" in parsed &&
      typeof parsed.code === "string" &&
      "source" in parsed &&
      (parsed.source === "manual_code" || parsed.source === "magic_link")
    ) {
      return { code: parsed.code, source: parsed.source };
    }
    return null;
  } catch {
    return null;
  }
};

export const clearPendingAccessCode = () => {
  try {
    sessionStorage.removeItem(STORAGE_KEYS.pendingAccessCode);
  } catch {
    // Nichts zu tun.
  }
};
