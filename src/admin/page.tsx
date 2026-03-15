import { useState, useEffect } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Key, Check, LogOut, Plus, Copy } from "lucide-react";
import logoImage from "../assets/images/logo.png";

export default function Page() {
  const [draftSecret, setDraftSecret] = useState(
    () => localStorage.getItem("adminSecret") || "",
  );
  const [adminSecret, setAdminSecret] = useState(draftSecret);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [identityLabel, setIdentityLabel] = useState("");
  const [identityEmail, setIdentityEmail] = useState("");
  const [note, setNote] = useState("");
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [generatedIdentityLabel, setGeneratedIdentityLabel] =
    useState<string>("");

  const verifySecret = useQuery(api.admin.verifySecret, { adminSecret });
  const generateMagicLink = useMutation(api.admin.generateMagicLink);

  const isAuthorized = !!verifySecret?.valid;
  const loginError =
    verifySecret && !verifySecret.valid && adminSecret
      ? "Ungültiges Admin-Secret."
      : "";

  useEffect(() => {
    if (isAuthorized) {
      localStorage.setItem("adminSecret", adminSecret);
    }
  }, [isAuthorized, adminSecret]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setAdminSecret(draftSecret);
  };

  const handleLogout = () => {
    setDraftSecret("");
    setAdminSecret("");
    localStorage.removeItem("adminSecret");
    setGeneratedLink(null);
    setGeneratedIdentityLabel("");
  };

  const handleGenerateLink = async () => {
    const trimmedIdentityLabel = identityLabel.trim();

    if (!trimmedIdentityLabel) {
      alert("Bitte gib den Namen oder die Kennung des Nutzers ein.");
      return;
    }

    try {
      setCopiedCode(null); // Clear previous "Kopiert!" state
      setGeneratedLink(null); // Clear previous generated link
      const { code } = await generateMagicLink({
        adminSecret,
        identityLabel: trimmedIdentityLabel,
        identityEmail: identityEmail.trim() || undefined,
        note: note.trim() || undefined,
      });
      const magicLink = `${window.location.origin}/?code=SMARTNOTES-${code}`;
      setGeneratedLink(magicLink);
      setGeneratedIdentityLabel(trimmedIdentityLabel);
      setIdentityLabel("");
      setIdentityEmail("");
      setNote("");
    } catch (err) {
      console.error(err);
      alert("Fehler beim Generieren des Links.");
    }
  };

  const handleCopyLink = async () => {
    if (generatedLink) {
      try {
        await navigator.clipboard.writeText(generatedLink);
        setCopiedCode(generatedLink);
        setTimeout(() => setCopiedCode(null), 2000);
      } catch (err) {
        console.error("Failed to copy:", err);
        alert("Fehler beim Kopieren des Links.");
      }
    }
  };

  const handleNewLink = () => {
    setGeneratedLink(null);
    setGeneratedIdentityLabel("");
    setIdentityLabel("");
    setIdentityEmail("");
    setNote("");
  };

  if (!isAuthorized) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-4 dark:bg-gray-950">
        <div className="w-full max-w-md space-y-8 rounded-2xl border border-gray-100 bg-white p-8 shadow-xl dark:border-gray-800 dark:bg-gray-900">
          <div className="text-center">
            <img
              src={logoImage}
              alt="SmartNotes"
              className="mx-auto mb-4 h-12 w-auto rounded-xl"
            />
            <h2 className="flex items-center justify-center gap-2 text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
              Admin-Anmeldung
            </h2>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              Bitte gib dein Admin-Secret ein, um fortzufahren.
            </p>
          </div>
          <form className="mt-8 space-y-6" onSubmit={handleLogin}>
            <div>
              <label htmlFor="secret" className="sr-only">
                Admin-Secret
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <Key className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="secret"
                  type="password"
                  required
                  value={draftSecret}
                  onChange={(e) => setDraftSecret(e.target.value)}
                  className="block w-full rounded-xl border border-gray-300 bg-gray-50 py-3 pr-3 pl-10 text-gray-900 transition-all outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                  placeholder="Admin-Secret"
                />
              </div>
            </div>
            {loginError && (
              <p className="text-center text-sm text-red-600 dark:text-red-400">
                {loginError}
              </p>
            )}
            <button
              type="submit"
              disabled={verifySecret === undefined}
              className="group relative flex w-full justify-center rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 transition-all hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
            >
              {verifySecret === undefined ? "Verifiziere..." : "Anmelden"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-8 dark:bg-gray-950">
      <div className="mx-auto max-w-4xl">
        <header className="mb-8 flex flex-col items-center justify-between gap-4 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm sm:flex-row dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center gap-4">
            <img
              src={logoImage}
              alt="SmartNotes"
              className="h-10 w-auto rounded-lg"
            />
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                Admin-Dashboard
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Zugriffscodes und Nutzerzuordnung verwalten
              </p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            <LogOut className="h-4 w-4" />
            Abmelden
          </button>
        </header>

        <main className="space-y-6">
          <section className="rounded-2xl border border-gray-100 bg-white p-8 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <h2 className="mb-6 flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-white">
              <Plus className="h-5 w-5 text-blue-600" />
              Magic Link erstellen
            </h2>
            <div className="space-y-4">
              {generatedLink ? (
                <div className="space-y-4">
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-200">
                    Zugeordnet zu: <strong>{generatedIdentityLabel}</strong>
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Generierter Magic Link
                    </label>
                    <div className="flex rounded-xl shadow-sm">
                      <input
                        type="text"
                        value={generatedLink}
                        readOnly
                        className="block w-full min-w-0 flex-1 rounded-l-xl border border-gray-300 bg-gray-50 px-4 py-3 text-gray-900 transition-all outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                      />
                      <button
                        onClick={handleCopyLink}
                        className="inline-flex items-center rounded-r-xl border border-l-0 border-gray-300 bg-gray-200 px-6 py-3 text-sm font-medium text-gray-700 transition-all hover:bg-gray-300 focus:ring-2 focus:ring-blue-500 focus:outline-none dark:border-gray-700 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
                      >
                        {copiedCode ? (
                          <Check className="mr-2 h-5 w-5" />
                        ) : (
                          <Copy className="mr-2 h-5 w-5" />
                        )}
                        {copiedCode ? "Kopiert!" : "Kopieren"}
                      </button>
                    </div>
                  </div>
                  <button
                    onClick={handleNewLink}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-8 py-3 font-semibold text-white shadow-lg shadow-blue-500/20 transition-all hover:bg-blue-700 sm:w-auto"
                  >
                    <Plus className="h-5 w-5" />
                    Neuen Link generieren
                  </button>
                  {copiedCode && (
                    <p className="mt-2 animate-pulse text-sm text-green-600 dark:text-green-400">
                      Magic Link wurde in die Zwischenablage kopiert!
                    </p>
                  )}
                </div>
              ) : (
                <>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Name oder Kennung des Nutzers
                    </label>
                    <input
                      type="text"
                      value={identityLabel}
                      onChange={(e) => setIdentityLabel(e.target.value)}
                      placeholder="z. B. Max Mustermann oder Matrikelnummer"
                      className="w-full rounded-xl border border-gray-300 bg-gray-50 px-4 py-3 text-gray-900 transition-all outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                      E-Mail-Adresse (optional)
                    </label>
                    <input
                      type="email"
                      value={identityEmail}
                      onChange={(e) => setIdentityEmail(e.target.value)}
                      placeholder="max@schule.de"
                      className="w-full rounded-xl border border-gray-300 bg-gray-50 px-4 py-3 text-gray-900 transition-all outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Notiz (optional)
                    </label>
                    <input
                      type="text"
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="z. B. Kurs, Gruppe oder interner Hinweis"
                      className="w-full rounded-xl border border-gray-300 bg-gray-50 px-4 py-3 text-gray-900 transition-all outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                    />
                  </div>
                  <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/60 dark:text-amber-200">
                    Ohne Nutzerzuordnung wird kein Link mehr erstellt. Jeder
                    Zugangscode muss einer identifizierbaren Person zugeordnet
                    sein.
                  </p>
                  <button
                    onClick={handleGenerateLink}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-8 py-3 font-semibold text-white shadow-lg shadow-blue-500/20 transition-all hover:bg-blue-700 sm:w-auto"
                  >
                    <Plus className="h-5 w-5" />
                    Link generieren
                  </button>
                </>
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-gray-100 bg-white p-8 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Hilfe & Infos
              </h2>
            </div>
            <div className="prose prose-sm dark:prose-invert max-w-none text-gray-600 dark:text-gray-400">
              <p>
                Der Magic Link enthält einen einmalig verwendbaren Zugangscode.
                Sobald der Nutzer den Link öffnet, wird der Code im Backend
                entwertet und eine dauerhafte, einer Person zugeordnete Sitzung
                im Browser des Nutzers erstellt.
              </p>
              <ul className="list-disc space-y-2 pl-5">
                <li>Links und Zugangscodes sind nur einmal gültig.</li>
                <li>
                  Die Nutzerzuordnung bleibt nach dem Einlösen zur Verwaltung,
                  Nachvollziehbarkeit und für Analytics erhalten.
                </li>
                <li>
                  Das Admin-Secret wird lokal im Browser gespeichert, bis du
                  dich abmeldest.
                </li>
              </ul>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
