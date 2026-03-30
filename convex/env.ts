const TRUE_VALUES = new Set(["1", "true", "yes", "on"]);

export const readOptionalEnv = (name: string) => {
  const rawValue = process.env[name];
  if (typeof rawValue !== "string") {
    return undefined;
  }

  const trimmedValue = rawValue.trim();
  return trimmedValue.length > 0 ? trimmedValue : undefined;
};

export const readOptionalEnvFromAliases = (names: string[]) => {
  for (const name of names) {
    const value = readOptionalEnv(name);
    if (value) {
      return value;
    }
  }

  return undefined;
};

export const readRequiredEnv = (name: string, errorMessage?: string) => {
  const value = readOptionalEnv(name);
  if (!value) {
    throw new Error(errorMessage ?? `${name} ist nicht konfiguriert.`);
  }

  return value;
};

export const readBooleanEnv = (name: string, fallback = false) => {
  const value = readOptionalEnv(name);
  if (!value) {
    return fallback;
  }

  return TRUE_VALUES.has(value.toLowerCase());
};

type ReadIntegerOptions = {
  min?: number;
  max?: number;
};

export const readIntegerEnv = (
  name: string,
  fallback: number,
  options?: ReadIntegerOptions,
) => {
  const value = readOptionalEnv(name);
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  const min = options?.min ?? Number.NEGATIVE_INFINITY;
  const max = options?.max ?? Number.POSITIVE_INFINITY;
  return Math.max(min, Math.min(max, parsed));
};
