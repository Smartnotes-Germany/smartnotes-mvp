const getConfiguredAdminSecret = () => {
  const secret = process.env.ACCESS_CODE_ADMIN_SECRET;
  if (!secret) {
    throw new Error("ACCESS_CODE_ADMIN_SECRET ist nicht konfiguriert.");
  }
  return secret;
};

export const assertAdminSecret = (providedSecret: string) => {
  const expectedSecret = getConfiguredAdminSecret();
  if (providedSecret !== expectedSecret) {
    throw new Error("Ungültiges Admin-Secret.");
  }
};
