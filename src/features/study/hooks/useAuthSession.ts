import { useCallback, useEffect, useRef, useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import {
  latestSessionIdRef,
  redeemAccessCodeRef,
  startSessionRef,
  validateGrantRef,
} from "../convexRefs";
import { STORAGE_KEYS } from "../constants";
import { formatError } from "../errorUtils";
import type { GrantStatus, StudySessionId } from "../types";
import {
  identifyPostHogUser,
  registerPostHogContext,
  resetPostHogUser,
  trackAuthCodeRedeemFailed,
  trackAuthCodeRedeemStarted,
  trackAuthCodeRedeemSucceeded,
  trackSessionResumed,
  trackSessionSignout,
  trackSessionStarted,
} from "../analytics";

export type AuthSessionReturn = {
  grantToken: string | null;
  sessionId: StudySessionId | null;
  grantStatus: GrantStatus | undefined;
  latestSessionId: string | null | undefined;
  accessCodeInput: string;
  authError: string | null;
  isRedeemingCode: boolean;
  isCreatingSession: boolean;
  isSigningOut: boolean;
  isConsumingMagicLink: boolean;
  hasAcceptedPrivacy: boolean;
  isAcceptingPrivacy: boolean;
  setAccessCodeInput: (value: string) => void;
  setAuthError: (error: string | null) => void;
  redeemCode: () => Promise<void>;
  startFreshSession: () => Promise<string | null>;
  signOut: () => void;
  acceptPrivacy: () => Promise<void>;
};

export function useAuthSession(): AuthSessionReturn {
  const [grantToken, setGrantToken] = useState<string | null>(() =>
    localStorage.getItem(STORAGE_KEYS.grantToken),
  );
  const [sessionId, setSessionId] = useState<StudySessionId | null>(() => {
    return localStorage.getItem(
      STORAGE_KEYS.sessionId,
    ) as StudySessionId | null;
  });
  const [hasAcceptedPrivacy, setHasAcceptedPrivacy] = useState<boolean>(() => {
    return localStorage.getItem("smartnotes.privacy-accepted") === "true";
  });
  const [isAcceptingPrivacy, setIsAcceptingPrivacy] = useState(false);

  const [accessCodeInput, setAccessCodeInput] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [isRedeemingCode, setIsRedeemingCode] = useState(false);
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isConsumingMagicLink, setIsConsumingMagicLink] = useState(false);

  const isProcessingMagicLink = useRef(false);
  const signOutTimeoutRef = useRef<number | null>(null);
  const startedSessionIdsRef = useRef(new Set<string>());
  const lastResumedSessionIdRef = useRef<string | null>(null);

  const markStartedSession = useCallback(
    (newSessionId: string, source: "auth_code" | "auto" | "fresh") => {
      startedSessionIdsRef.current.add(newSessionId);
      trackSessionStarted(source);
    },
    [],
  );

  const maybeTrackResumedSession = useCallback((resumedSessionId: string) => {
    if (startedSessionIdsRef.current.has(resumedSessionId)) {
      return;
    }

    if (lastResumedSessionIdRef.current === resumedSessionId) {
      return;
    }

    lastResumedSessionIdRef.current = resumedSessionId;
    trackSessionResumed();
  }, []);

  const redeemAccessCode = useAction(redeemAccessCodeRef);
  const startSession = useMutation(startSessionRef);

  const grantStatus = useQuery(
    validateGrantRef,
    grantToken ? { grantToken } : "skip",
  );

  const latestSessionId = useQuery(
    latestSessionIdRef,
    grantToken && grantStatus?.valid ? { grantToken } : "skip",
  );

  const acceptPrivacy = useCallback(async () => {
    setIsAcceptingPrivacy(true);
    // Simuliere kurze Verzögerung für UX, falls gewünscht, oder direkt setzen
    localStorage.setItem("smartnotes.privacy-accepted", "true");
    setHasAcceptedPrivacy(true);
    setIsAcceptingPrivacy(false);
  }, []);

  const applyAnalyticsIdentity = useCallback(
    (identity: {
      analyticsDistinctId: string;
      analyticsGrantId: string;
      identityLabel: string;
      identityQuality: "email" | "app_only";
      identityEmail?: string;
      note?: string;
    }) => {
      identifyPostHogUser(identity, {
        analyticsGrantId: identity.analyticsGrantId,
        sessionId,
      });
    },
    [sessionId],
  );

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");

    if (code && !grantToken && !isProcessingMagicLink.current) {
      isProcessingMagicLink.current = true;
      setIsConsumingMagicLink(true);
      trackAuthCodeRedeemStarted("magic_link");

      const newUrl = window.location.origin + window.location.pathname;
      window.history.replaceState({}, document.title, newUrl);

      void redeemAccessCode({ code, source: "magic_link" })
        .then((result) => {
          setGrantToken(result.grantToken);
          localStorage.setItem(STORAGE_KEYS.grantToken, result.grantToken);
          identifyPostHogUser(
            {
              analyticsDistinctId: result.analyticsDistinctId,
              analyticsGrantId: result.analyticsGrantId,
              identityLabel: result.identityLabel,
              identityQuality: result.identityQuality,
              identityEmail: result.identityEmail,
              note: result.note,
            },
            {
              analyticsGrantId: result.analyticsGrantId,
            },
          );
          trackAuthCodeRedeemSucceeded("magic_link");
        })
        .catch((error: unknown) => {
          if (grantToken) {
            return;
          }
          trackAuthCodeRedeemFailed("magic_link");
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
  }, [grantToken, redeemAccessCode]);

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
    if (!grantToken || !grantStatus?.valid) {
      return;
    }

    if (
      !grantStatus.analyticsDistinctId ||
      !grantStatus.analyticsGrantId ||
      !grantStatus.identityLabel ||
      !grantStatus.identityQuality
    ) {
      return;
    }

    applyAnalyticsIdentity({
      analyticsDistinctId: grantStatus.analyticsDistinctId,
      analyticsGrantId: grantStatus.analyticsGrantId,
      identityLabel: grantStatus.identityLabel,
      identityQuality: grantStatus.identityQuality,
      identityEmail: grantStatus.identityEmail,
      note: grantStatus.note,
    });
  }, [applyAnalyticsIdentity, grantStatus, grantToken]);

  useEffect(() => {
    if (!grantStatus?.valid || !grantStatus.analyticsGrantId) {
      return;
    }

    registerPostHogContext({
      analyticsGrantId: grantStatus.analyticsGrantId,
      sessionId,
    });
  }, [grantStatus, sessionId]);

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
      maybeTrackResumedSession(latestSessionId);
      return;
    }

    setIsCreatingSession(true);
    void startSession({ grantToken })
      .then((newSessionId) => {
        setSessionId(newSessionId);
        localStorage.setItem(STORAGE_KEYS.sessionId, newSessionId);
        registerPostHogContext({
          analyticsGrantId: grantStatus.analyticsGrantId,
          sessionId: newSessionId,
        });
        markStartedSession(newSessionId, "auto");
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
    markStartedSession,
    maybeTrackResumedSession,
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
      registerPostHogContext({
        analyticsGrantId: grantStatus.analyticsGrantId,
        sessionId: latestSessionId,
      });
      maybeTrackResumedSession(latestSessionId);
    }
  }, [
    grantStatus,
    grantToken,
    latestSessionId,
    maybeTrackResumedSession,
    sessionId,
  ]);

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

    trackAuthCodeRedeemStarted();
    setIsRedeemingCode(true);
    setAuthError(null);

    try {
      const auth = await redeemAccessCode({
        code: accessCodeInput,
        source: "manual_code",
      });
      const newSessionId = await startSession({ grantToken: auth.grantToken });
      setGrantToken(auth.grantToken);
      setSessionId(newSessionId);
      localStorage.setItem(STORAGE_KEYS.grantToken, auth.grantToken);
      localStorage.setItem(STORAGE_KEYS.sessionId, newSessionId);
      setAccessCodeInput("");
      identifyPostHogUser(
        {
          analyticsDistinctId: auth.analyticsDistinctId,
          analyticsGrantId: auth.analyticsGrantId,
          identityLabel: auth.identityLabel,
          identityQuality: auth.identityQuality,
          identityEmail: auth.identityEmail,
          note: auth.note,
        },
        {
          analyticsGrantId: auth.analyticsGrantId,
          sessionId: newSessionId,
        },
      );
      markStartedSession(newSessionId, "auth_code");
      trackAuthCodeRedeemSucceeded();
    } catch (error: unknown) {
      trackAuthCodeRedeemFailed();
      setAuthError(
        formatError(error, {
          fallback:
            "Die Anmeldung ist fehlgeschlagen. Bitte prüfe den Zugangscode und versuche es erneut.",
        }),
      );
    } finally {
      setIsRedeemingCode(false);
    }
  }, [accessCodeInput, markStartedSession, redeemAccessCode, startSession]);

  const startFreshSession = useCallback(async (): Promise<string | null> => {
    if (!grantToken) {
      return null;
    }

    setIsCreatingSession(true);
    try {
      const newSessionId = await startSession({ grantToken });
      setSessionId(newSessionId);
      localStorage.setItem(STORAGE_KEYS.sessionId, newSessionId);
      registerPostHogContext({
        analyticsGrantId: grantStatus?.analyticsGrantId ?? null,
        sessionId: newSessionId,
      });
      markStartedSession(newSessionId, "fresh");
      return null;
    } catch (error: unknown) {
      return formatError(error, {
        fallback:
          "Die neue Sitzung konnte nicht gestartet werden. Bitte versuche es erneut.",
      });
    } finally {
      setIsCreatingSession(false);
    }
  }, [
    grantStatus?.analyticsGrantId,
    grantToken,
    markStartedSession,
    startSession,
  ]);

  const signOut = useCallback(() => {
    trackSessionSignout();
    setIsSigningOut(true);
    signOutTimeoutRef.current = window.setTimeout(() => {
      setGrantToken(null);
      setSessionId(null);
      setAuthError(null);
      setHasAcceptedPrivacy(false); // Reset privacy acceptance on sign out
      localStorage.removeItem(STORAGE_KEYS.grantToken);
      localStorage.removeItem(STORAGE_KEYS.sessionId);
      localStorage.removeItem("smartnotes.privacy-accepted"); // Also remove from local storage
      resetPostHogUser();
      setIsSigningOut(false);
      signOutTimeoutRef.current = null;
    }, 500);
  }, [setHasAcceptedPrivacy]);

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
    hasAcceptedPrivacy,
    isAcceptingPrivacy,
    setAccessCodeInput,
    setAuthError,
    redeemCode,
    startFreshSession,
    signOut,
    acceptPrivacy,
  };
}
