import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import {
  consumeMagicLinkRef,
  latestSessionIdRef,
  redeemAccessCodeRef,
  startSessionRef,
  validateGrantRef,
} from "../convexRefs";
import { STORAGE_KEYS } from "../constants";
import { formatError } from "../errorUtils";

export function useAuthSession() {
  const [grantToken, setGrantToken] = useState<string | null>(() =>
    localStorage.getItem(STORAGE_KEYS.grantToken),
  );
  const [sessionId, setSessionId] = useState<string | null>(() =>
    localStorage.getItem(STORAGE_KEYS.sessionId),
  );
  const [accessCodeInput, setAccessCodeInput] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [isRedeemingCode, setIsRedeemingCode] = useState(false);
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isConsumingMagicLink, setIsConsumingMagicLink] = useState(false);

  const isProcessingMagicLink = useRef(false);
  const signOutTimeoutRef = useRef<number | null>(null);

  const redeemAccessCode = useMutation(redeemAccessCodeRef);
  const consumeMagicLink = useMutation(consumeMagicLinkRef);
  const startSession = useMutation(startSessionRef);

  const grantStatus = useQuery(
    validateGrantRef,
    grantToken ? { grantToken } : "skip",
  );

  const latestSessionId = useQuery(
    latestSessionIdRef,
    grantToken && grantStatus?.valid ? { grantToken } : "skip",
  );

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");

    if (code && !grantToken && !isProcessingMagicLink.current) {
      isProcessingMagicLink.current = true;
      setIsConsumingMagicLink(true);

      const newUrl = window.location.origin + window.location.pathname;
      window.history.replaceState({}, document.title, newUrl);

      void consumeMagicLink({ code })
        .then((result) => {
          setGrantToken(result.grantToken);
          localStorage.setItem(STORAGE_KEYS.grantToken, result.grantToken);
        })
        .catch((error: unknown) => {
          if (grantToken) {
            return;
          }
          setAuthError(
            formatError(error, {
              fallback:
                "Die Anmeldung über den Link ist fehlgeschlagen. Bitte fordere einen neuen Link an.",
            }),
          );
        })
        .finally(() => {
          setIsConsumingMagicLink(false);
        });
    }
  }, [consumeMagicLink, grantToken]);

  useEffect(() => {
    if (!grantToken || !grantStatus || grantStatus.valid) {
      return;
    }
    setGrantToken(null);
    setSessionId(null);
    localStorage.removeItem(STORAGE_KEYS.grantToken);
    localStorage.removeItem(STORAGE_KEYS.sessionId);
  }, [grantStatus, grantToken]);

  useEffect(() => {
    if (
      !grantToken ||
      !grantStatus?.valid ||
      sessionId ||
      latestSessionId === undefined ||
      isCreatingSession
    ) {
      return;
    }

    if (latestSessionId) {
      setSessionId(latestSessionId);
      localStorage.setItem(STORAGE_KEYS.sessionId, latestSessionId);
      return;
    }

    setIsCreatingSession(true);
    void startSession({ grantToken })
      .then((newSessionId) => {
        setSessionId(newSessionId);
        localStorage.setItem(STORAGE_KEYS.sessionId, newSessionId);
      })
      .catch((error: unknown) => {
        setAuthError(
          formatError(error, {
            fallback:
              "Deine Sitzung konnte nicht gestartet werden. Bitte versuche es erneut.",
          }),
        );
      })
      .finally(() => setIsCreatingSession(false));
  }, [
    grantToken,
    grantStatus,
    isCreatingSession,
    latestSessionId,
    sessionId,
    startSession,
  ]);

  useEffect(() => {
    if (!grantToken || !grantStatus?.valid || latestSessionId === undefined) {
      return;
    }
    if (!latestSessionId) {
      if (sessionId) {
        setSessionId(null);
        localStorage.removeItem(STORAGE_KEYS.sessionId);
      }
      return;
    }
    if (sessionId !== latestSessionId) {
      setSessionId(latestSessionId);
      localStorage.setItem(STORAGE_KEYS.sessionId, latestSessionId);
    }
  }, [grantStatus, grantToken, latestSessionId, sessionId]);

  useEffect(() => {
    return () => {
      if (signOutTimeoutRef.current !== null) {
        window.clearTimeout(signOutTimeoutRef.current);
      }
    };
  }, []);

  const redeemCode = useCallback(async () => {
    if (!accessCodeInput.trim()) {
      setAuthError("Bitte gib deinen Einmal-Zugangscode ein.");
      return;
    }

    setIsRedeemingCode(true);
    setAuthError(null);

    try {
      const auth = await redeemAccessCode({ code: accessCodeInput });
      const newSessionId = await startSession({ grantToken: auth.grantToken });
      setGrantToken(auth.grantToken);
      setSessionId(newSessionId);
      localStorage.setItem(STORAGE_KEYS.grantToken, auth.grantToken);
      localStorage.setItem(STORAGE_KEYS.sessionId, newSessionId);
      setAccessCodeInput("");
    } catch (error: unknown) {
      setAuthError(
        formatError(error, {
          fallback:
            "Die Anmeldung ist fehlgeschlagen. Bitte prüfe den Zugangscode und versuche es erneut.",
        }),
      );
    } finally {
      setIsRedeemingCode(false);
    }
  }, [accessCodeInput, redeemAccessCode, startSession]);

  const startFreshSession = useCallback(async (): Promise<string | null> => {
    if (!grantToken) {
      return null;
    }

    setIsCreatingSession(true);
    try {
      const newSessionId = await startSession({ grantToken });
      setSessionId(newSessionId);
      localStorage.setItem(STORAGE_KEYS.sessionId, newSessionId);
      return null;
    } catch (error: unknown) {
      return formatError(error, {
        fallback:
          "Die neue Sitzung konnte nicht gestartet werden. Bitte versuche es erneut.",
      });
    } finally {
      setIsCreatingSession(false);
    }
  }, [grantToken, startSession]);

  const signOut = useCallback(() => {
    setIsSigningOut(true);
    signOutTimeoutRef.current = window.setTimeout(() => {
      setGrantToken(null);
      setSessionId(null);
      setAuthError(null);
      localStorage.removeItem(STORAGE_KEYS.grantToken);
      localStorage.removeItem(STORAGE_KEYS.sessionId);
      setIsSigningOut(false);
      signOutTimeoutRef.current = null;
    }, 500);
  }, []);

  return {
    grantToken,
    sessionId,
    grantStatus,
    latestSessionId,
    accessCodeInput,
    authError,
    isRedeemingCode,
    isCreatingSession,
    isSigningOut,
    isConsumingMagicLink,
    setAccessCodeInput,
    setAuthError,
    redeemCode,
    startFreshSession,
    signOut,
  };
}
