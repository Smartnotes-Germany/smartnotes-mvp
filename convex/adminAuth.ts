// Access token
import { readRequiredEnv } from "./env";

const getConfiguredAdminSecret = () => {
  return readRequiredEnv(
    "ACCESS_CODE_ADMIN_SECRET",
    "ACCESS_CODE_ADMIN_SECRET ist nicht konfiguriert.",
  );
};

export const assertAdminSecret = (providedSecret: string) => {
  const expectedSecret = getConfiguredAdminSecret();
  if (providedSecret !== expectedSecret) {
    throw new Error("Ungültiges Admin-Secret.");
  }
};
