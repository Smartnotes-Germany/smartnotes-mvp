import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./errorTracking";
import {
  buildAnalyticsDistinctId,
  normalizeIdentityEmail,
  normalizeIdentityLabel,
} from "../shared/identity";
import {
  MAX_COMPANY_NAME_LENGTH,
  MAX_SCHOOL_CHALLENGE_LENGTH,
} from "../shared/onboarding";
import { getIdentityQuality } from "../shared/posthogRuntime";

export const getCurrentUser = async (ctx: QueryCtx | MutationCtx) => {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    return null;
  }

  return ctx.db
    .query("users")
    .withIndex("by_tokenIdentifier", (q) =>
      q.eq("tokenIdentifier", identity.tokenIdentifier),
    )
    .unique();
};

/** Liefert das angemeldete, per Zugangscode freigeschaltete Konto. */
export const requireActiveUser = async (ctx: QueryCtx | MutationCtx) => {
  const user = await getCurrentUser(ctx);
  if (!user) {
    throw new Error("Bitte melde dich an.");
  }
  if (!user.activatedAt) {
    throw new Error("Dein Konto ist noch nicht freigeschaltet.");
  }

  return user;
};

export const buildUserAccessKey = (user: Doc<"users">) => `user:${user._id}`;

export const buildUserAnalyticsIdentity = (user: Doc<"users">) => {
  const identityEmail = user.email;

  return {
    identityLabel: user.name ?? identityEmail ?? `Konto ${user._id}`,
    ...(identityEmail ? { identityEmail } : {}),
    identityQuality: getIdentityQuality({ identityEmail }),
    analyticsDistinctId: buildAnalyticsDistinctId({
      userId: user._id,
      identityEmail,
    }),
    analyticsUserId: user._id,
  };
};

/** Legt das Konto beim ersten Login an und gleicht E-Mail und Name mit Clerk ab. */
export const store = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Bitte melde dich an.");
    }

    const email = identity.email
      ? normalizeIdentityEmail(identity.email)
      : undefined;
    const name = identity.name ? normalizeIdentityLabel(identity.name) : "";
    const existing = await getCurrentUser(ctx);
    const now = Date.now();

    if (existing) {
      if (existing.email !== email || (existing.name ?? "") !== name) {
        await ctx.db.patch("users", existing._id, {
          email,
          name: name || undefined,
          updatedAt: now,
        });
      }
      return existing._id;
    }

    return ctx.db.insert("users", {
      tokenIdentifier: identity.tokenIdentifier,
      ...(email ? { email } : {}),
      ...(name ? { name } : {}),
      createdAt: now,
      updatedAt: now,
    });
  },
});

/** Status des angemeldeten Kontos; `null`, solange `store` noch nicht lief. */
export const viewer = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) {
      return null;
    }

    return {
      activated: Boolean(user.activatedAt),
      onboarded: Boolean(user.onboardingCompletedAt),
      ...buildUserAnalyticsIdentity(user),
    };
  },
});

/**
 * Speichert die Angaben, die nach der Registrierung einmalig abgefragt werden.
 * Nur das Unternehmen ist Pflicht, die Schulfrage ist freiwillig.
 */
export const completeOnboarding = mutation({
  args: {
    companyName: v.string(),
    schoolChallenge: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireActiveUser(ctx);
    const companyName = args.companyName.trim();
    const schoolChallenge = args.schoolChallenge?.trim() ?? "";

    if (!companyName) {
      throw new Error("Bitte gib dein Unternehmen an.");
    }
    if (companyName.length > MAX_COMPANY_NAME_LENGTH) {
      throw new Error(
        `Der Unternehmensname darf höchstens ${MAX_COMPANY_NAME_LENGTH} Zeichen lang sein.`,
      );
    }
    if (schoolChallenge.length > MAX_SCHOOL_CHALLENGE_LENGTH) {
      throw new Error(
        `Deine Antwort darf höchstens ${MAX_SCHOOL_CHALLENGE_LENGTH} Zeichen lang sein.`,
      );
    }

    const now = Date.now();
    await ctx.db.patch("users", user._id, {
      companyName,
      schoolChallenge: schoolChallenge || undefined,
      onboardingCompletedAt: now,
      updatedAt: now,
    });
    return null;
  },
});
