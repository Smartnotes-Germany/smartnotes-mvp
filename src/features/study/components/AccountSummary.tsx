import { useClerk, useUser } from "@clerk/react";

/** Name und E-Mail des angemeldeten Kontos, mit Zugang zu Clerks Kontoverwaltung. */
export function AccountSummary() {
  const { user } = useUser();
  const clerk = useClerk();

  if (!user) {
    return null;
  }

  const email = user.primaryEmailAddress?.emailAddress;
  const name = user.fullName || email;

  return (
    <div className="border-cream-border border-t pt-4 pb-2">
      <p className="text-ink truncate text-sm font-medium">{name}</p>
      {email && name !== email && (
        <p className="text-ink-muted truncate text-xs">{email}</p>
      )}
      <button
        type="button"
        onClick={() => clerk.openUserProfile()}
        className="text-accent mt-2 text-xs font-medium underline-offset-4 hover:underline"
      >
        Konto verwalten
      </button>
    </div>
  );
}
