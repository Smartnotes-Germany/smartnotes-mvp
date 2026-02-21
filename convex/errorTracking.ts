import {
  action as baseAction,
  internalAction as baseInternalAction,
  internalMutation as baseInternalMutation,
  internalQuery as baseInternalQuery,
  mutation as baseMutation,
  query as baseQuery,
} from "./_generated/server";

const ERROR_ID_PATTERN = /\[Fehler-ID:\s*([A-Z0-9-]+)\]/i;
const ERROR_ID_PREFIX = "SNERR";

type FunctionDefinition = {
  handler: (...args: readonly unknown[]) => unknown | Promise<unknown>;
};

const createErrorId = () => {
  const timestampPart = Date.now().toString(36).toUpperCase();
  const randomPart = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `${ERROR_ID_PREFIX}-${timestampPart}-${randomPart}`;
};

const getErrorMessage = (error: unknown) => {
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }
  if (typeof error === "string" && error.trim()) {
    return error.trim();
  }
  return "Ein unerwarteter Fehler ist aufgetreten.";
};

const getExistingErrorId = (error: unknown) => {
  const message = getErrorMessage(error);
  const match = message.match(ERROR_ID_PATTERN);
  return match?.[1] ?? null;
};

const buildTrackedError = (error: unknown, errorId: string) => {
  const baseMessage = getErrorMessage(error)
    .replace(ERROR_ID_PATTERN, "")
    .trim();
  const withErrorId = `${baseMessage} [Fehler-ID: ${errorId}]`;

  if (error instanceof Error) {
    const wrappedError = new Error(withErrorId);
    wrappedError.name = error.name;
    return wrappedError;
  }

  return new Error(withErrorId);
};

const logTrackedError = (
  errorId: string,
  error: unknown,
  functionKind: string,
  handlerName: string,
) => {
  const errorRecord =
    error && typeof error === "object"
      ? (error as {
          name?: unknown;
          message?: unknown;
          stack?: unknown;
        })
      : null;

  console.error("[Fehler-Tracking]", {
    errorId,
    functionKind,
    handlerName,
    errorName:
      errorRecord && typeof errorRecord.name === "string"
        ? errorRecord.name
        : undefined,
    errorMessage:
      errorRecord && typeof errorRecord.message === "string"
        ? errorRecord.message
        : getErrorMessage(error),
    errorStack:
      errorRecord && typeof errorRecord.stack === "string"
        ? errorRecord.stack
        : undefined,
  });
};

const withErrorTracking = <T extends FunctionDefinition>(
  definition: T,
  functionKind: string,
) => {
  const handlerName = definition.handler.name || "anonymous";
  const wrappedDefinition = {
    ...definition,
    handler: async (...args: Parameters<T["handler"]>) => {
      try {
        return await definition.handler(...args);
      } catch (error) {
        const existingErrorId = getExistingErrorId(error);
        if (existingErrorId) {
          logTrackedError(existingErrorId, error, functionKind, handlerName);
          throw error;
        }

        const errorId = createErrorId();
        logTrackedError(errorId, error, functionKind, handlerName);
        throw buildTrackedError(error, errorId);
      }
    },
  };

  return wrappedDefinition as T;
};

export const query: typeof baseQuery = ((definition: unknown) =>
  baseQuery(
    withErrorTracking(definition as FunctionDefinition, "query"),
  )) as typeof baseQuery;

export const mutation: typeof baseMutation = ((definition: unknown) =>
  baseMutation(
    withErrorTracking(definition as FunctionDefinition, "mutation"),
  )) as typeof baseMutation;

export const action: typeof baseAction = ((definition: unknown) =>
  baseAction(
    withErrorTracking(definition as FunctionDefinition, "action"),
  )) as typeof baseAction;

export const internalQuery: typeof baseInternalQuery = ((definition: unknown) =>
  baseInternalQuery(
    withErrorTracking(definition as FunctionDefinition, "internalQuery"),
  )) as typeof baseInternalQuery;

export const internalMutation: typeof baseInternalMutation = ((
  definition: unknown,
) =>
  baseInternalMutation(
    withErrorTracking(definition as FunctionDefinition, "internalMutation"),
  )) as typeof baseInternalMutation;

export const internalAction: typeof baseInternalAction = ((
  definition: unknown,
) =>
  baseInternalAction(
    withErrorTracking(definition as FunctionDefinition, "internalAction"),
  )) as typeof baseInternalAction;

export type { ActionCtx, MutationCtx, QueryCtx } from "./_generated/server";
