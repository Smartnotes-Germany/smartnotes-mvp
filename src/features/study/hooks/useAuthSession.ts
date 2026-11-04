import { useCallback, useEffect, useRef, useState } from "react";
import { useClerk } from "@clerk/react";
import { useAction, useConvexAuth, useMutation, useQuery } from "convex/react";
import { redeemAccessCodeRef, storeUserRef, viewerRef } from "../convexRefs";
import { formatError } from "../errorUtils";
import {
  clearPendingAccessCode,
  readPendingAccessCode,
} from "../pendingAccessCode";
import type { Viewer } from "../types";
import {
  identifyPostHogUser,
  resetPostHogUser,
  trackAuthCodeRedeemFailed,
  trackAuthCodeRedeemStarted,
  trackAuthCodeRedeemSucceeded,
  trackConsentUpdated,
  trackSessionSignout,
} from "../analytics";

const PRIVACY_ACCEPTED_KEY = "smartnotes.privacy-accepted";

type AuthSessionReturn = {
  isAuthLoading: boolean;
  isAuthenticated: boolean;
  viewer: Viewer | null | undefined;
  authError: string | null;
  isActivating: boolean;
  isSigningOut: boolean;
  hasAcceptedPrivacy: boolean;
  isAcceptingPrivacy: boolean;
  signOut: () => Promise<void>;
  acceptPrivacy: () => Promise<void>;
};

export function useAuthSession(): AuthSessionReturn {
  const { isLoading: isAuthLoading, isAuthenticated } = useConvexAuth();
  const clerk = useClerk();

  const [hasAcceptedPrivacy, setHasAcceptedPrivacy] = useState<boolean>(() => {
    return localStorage.getItem(PRIVACY_ACCEPTED_KEY) === "true";
  });
  const [isAcceptingPrivacy, setIsAcceptingPrivacy] = useState(false);

  const [isUserStored, setIsUserStored] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  // Bis der vorgemerkte Code eingelöst ist, gilt das Konto als „wird
  // freigeschaltet“ statt als gesperrt.
  const [isActivating, setIsActivating] = useState(
    () => readPendingAccessCode() !== null,
  );
  const [isSigningOut, setIsSigningOut] = useState(false);

  const isRedeemingPendingCodeRef = useRef(false);

  const storeUser = useMutation(storeUserRef);
  const redeemAccessCode = useAction(redeemAccessCodeRef);

  const viewer = useQuery(
    viewerRef,
    isAuthenticated && isUserStored ? {} : "skip",
  );

  useEffect(() => {
    if (!isAuthenticated) {
      setIsUserStored(false);
      return;
    }

    let isCancelled = false;
    void storeUser({})
      .then(() => {
        if (!isCancelled) {
          setIsUserStored(true);
        }
      })
      .catch((error: unknown) => {
        if (!isCancelled) {
          setAuthError(
            formatError(error, {
              fallback:
                "Dein Konto konnte nicht geladen werden. Bitte lade die Seite neu.",
            }),
          );
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [isAuthenticated, storeUser]);

  useEffect(() => {
    if (!viewer) {
      return;
    }

    // Die geöffnete Prüfung meldet ExamFlow selbst an PostHog.
    identifyPostHogUser(viewer, {
      analyticsUserId: viewer.analyticsUserId,
      sessionId: null,
    });
  }, [viewer]);

  const submitAccessCode = useCallback(
    async (code: string, source: "manual_code" | "magic_link") => {
      trackAuthCodeRedeemStarted(source);
      setIsActivating(true);
      setAuthError(null);

      try {
        await redeemAccessCode({ code, source });
        trackAuthCodeRedeemSucceeded(source);
      } catch (error: unknown) {
        trackAuthCodeRedeemFailed(source);
        setAuthError(
          formatError(error, {
            fallback:
              source === "magic_link"
                ? "Der Code aus deinem Link konnte nicht eingelöst werden."
                : "Dein Zugangscode konnte nicht eingelöst werden.",
          }),
        );
      } finally {
        setIsActivating(false);
      }
    },
    [redeemAccessCode],
  );

  // Ein Code aus einem Magic Link oder aus der Registrierung wird nach der
  // Anmeldung automatisch eingelöst.
  useEffect(() => {
    if (!viewer || viewer.activated || isRedeemingPendingCodeRef.current) {
      return;
    }

    const pendingCode = readPendingAccessCode();
    if (!pendingCode) {
      return;
    }

    isRedeemingPendingCodeRef.current = true;
    clearPendingAccessCode();
    void submitAccessCode(pendingCode.code, pendingCode.source);
  }, [submitAccessCode, viewer]);

  const acceptPrivacy = useCallback(async () => {
    setIsAcceptingPrivacy(true);
    localStorage.setItem(PRIVACY_ACCEPTED_KEY, "true");
    trackConsentUpdated("akzeptiert");
    setHasAcceptedPrivacy(true);
    setIsAcceptingPrivacy(false);
  }, []);

  const signOut = useCallback(async () => {
    trackSessionSignout();
    setIsSigningOut(true);
    try {
      await clerk.signOut();
      setAuthError(null);
      setHasAcceptedPrivacy(false);
      localStorage.removeItem(PRIVACY_ACCEPTED_KEY);
      clearPendingAccessCode();
      resetPostHogUser();
    } finally {
      setIsSigningOut(false);
    }
  }, [clerk]);

  return {
    isAuthLoading,
    isAuthenticated,
    viewer,
    authError,
    isActivating,
    isSigningOut,
    hasAcceptedPrivacy,
    isAcceptingPrivacy,
    signOut,
    acceptPrivacy,
  };
}
