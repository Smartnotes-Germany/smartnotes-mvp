import { httpRouter } from "convex/server";
import { internal } from "./_generated/api";
import { httpAction } from "./_generated/server";
import { readOptionalEnv } from "./env";
import {
  isValidCompanyName,
  isValidProfessions,
  normalizeCompanyName,
} from "./companyInquiries";
import { isApprenticeCount, isProfession } from "./leadValidators";
import { isValidWaitlistEmail, normalizeWaitlistEmail } from "./waitlist";

const http = httpRouter();

/** Vergleicht zwei Strings in konstanter Zeit, damit das Secret nicht per Timing erraten werden kann. */
const constantTimeEquals = (a: string, b: string) => {
  if (a.length !== b.length) {
    return false;
  }

  let difference = 0;
  for (let index = 0; index < a.length; index += 1) {
    difference |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }
  return difference === 0;
};

/** Nur der Server von stackprep.de kennt WAITLIST_API_SECRET. */
const isAuthorizedWaitlistRequest = (request: Request) => {
  const secret = readOptionalEnv("WAITLIST_API_SECRET");
  if (!secret) {
    return false;
  }

  return constantTimeEquals(
    request.headers.get("Authorization") ?? "",
    `Bearer ${secret}`,
  );
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });

/** Quelle und Kampagne sind freiwillig; alles, was kein String ist, fällt weg. */
const optionalString = (value: unknown) =>
  typeof value === "string" ? value : undefined;

const readJsonObject = async (request: Request) => {
  try {
    const body: unknown = await request.json();
    return typeof body === "object" && body !== null
      ? (body as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
};

http.route({
  path: "/waitlist/signup",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    if (!isAuthorizedWaitlistRequest(request)) {
      return json(401, { error: "unauthorized" });
    }

    const body = await readJsonObject(request);
    const {
      email,
      consentTextVersion,
      rateLimitKey,
      confirmationTokenHash,
      profession,
    } = body ?? {};
    if (
      typeof email !== "string" ||
      typeof consentTextVersion !== "string" ||
      typeof rateLimitKey !== "string" ||
      typeof confirmationTokenHash !== "string" ||
      !isValidWaitlistEmail(normalizeWaitlistEmail(email)) ||
      (profession !== undefined && !isProfession(profession))
    ) {
      return json(400, { error: "invalid_request" });
    }

    const result = await ctx.runMutation(internal.waitlist.signUp, {
      email,
      consentTextVersion,
      rateLimitKey,
      confirmationTokenHash,
      profession,
      source: optionalString(body?.source),
      campaign: optionalString(body?.campaign),
    });
    return json(200, result);
  }),
});

http.route({
  path: "/waitlist/confirm",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    if (!isAuthorizedWaitlistRequest(request)) {
      return json(401, { error: "unauthorized" });
    }

    const body = await readJsonObject(request);
    const confirmationTokenHash = body?.confirmationTokenHash;
    if (typeof confirmationTokenHash !== "string") {
      return json(400, { error: "invalid_request" });
    }

    const result = await ctx.runMutation(internal.waitlist.confirm, {
      confirmationTokenHash,
    });
    return json(200, result);
  }),
});

http.route({
  path: "/company/inquiry",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    if (!isAuthorizedWaitlistRequest(request)) {
      return json(401, { error: "unauthorized" });
    }

    const body = await readJsonObject(request);
    const {
      companyName,
      email,
      apprenticeCount,
      professions,
      consentTextVersion,
      rateLimitKey,
    } = body ?? {};
    if (
      typeof companyName !== "string" ||
      !isValidCompanyName(normalizeCompanyName(companyName)) ||
      typeof email !== "string" ||
      typeof consentTextVersion !== "string" ||
      typeof rateLimitKey !== "string" ||
      !isApprenticeCount(apprenticeCount) ||
      (professions !== undefined &&
        (typeof professions !== "string" ||
          !isValidProfessions(professions))) ||
      !isValidWaitlistEmail(normalizeWaitlistEmail(email))
    ) {
      return json(400, { error: "invalid_request" });
    }

    const result = await ctx.runMutation(internal.companyInquiries.submit, {
      companyName,
      email,
      apprenticeCount,
      professions,
      consentTextVersion,
      rateLimitKey,
      source: optionalString(body?.source),
      campaign: optionalString(body?.campaign),
    });
    return json(200, result);
  }),
});

http.route({
  path: "/campaign/visit",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    if (!isAuthorizedWaitlistRequest(request)) {
      return json(401, { error: "unauthorized" });
    }

    const body = await readJsonObject(request);
    const source = body?.source;
    const rateLimitKey = body?.rateLimitKey;
    if (typeof source !== "string" || typeof rateLimitKey !== "string") {
      return json(400, { error: "invalid_request" });
    }

    const result = await ctx.runMutation(internal.campaigns.recordVisit, {
      source,
      campaign: optionalString(body?.campaign),
      rateLimitKey,
    });
    return json(200, result);
  }),
});

export default http;
