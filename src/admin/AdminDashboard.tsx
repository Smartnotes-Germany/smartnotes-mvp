import { useState, useEffect } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Key, Check, LogOut, Plus, Copy } from "lucide-react";
import logoImage from "../assets/images/logo.png";

export default function AdminDashboard() {
  const [adminSecret, setAdminSecret] = useState(
    () => localStorage.getItem("adminSecret") || "",
  );
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);

  const verifySecret = useQuery(api.admin.verifySecret, { adminSecret });
  const generateMagicLink = useMutation(api.admin.generateMagicLink);

  const [isAuthorized, setIsAuthorized] = useState(
    verifySecret?.valid ?? false,
  );
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
    setIsAuthorized(true);
  };

  const handleLogout = () => {
    setAdminSecret("");
    setIsAuthorized(false);
    localStorage.removeItem("adminSecret");
    setGeneratedLink(null); // Also clear generated link on logout
  };

  const handleGenerateLink = async () => {
    try {
      setCopiedCode(null); // Clear previous "Kopiert!" state
      setGeneratedLink(null); // Clear previous generated link
      const { code } = await generateMagicLink({ adminSecret, note });
      const magicLink = `https://app.smartnotes.tech/?code=${code}`;
      setGeneratedLink(magicLink);
      setNote(""); // Clear the note input after link generation
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
        setTimeout(() => setCopiedCode(null), 2000); // Reset "Kopiert!" after 2 seconds
      } catch (err) {
        console.error("Failed to copy:", err);
        alert("Fehler beim Kopieren des Links.");
      }
    }
  };

  const handleNewLink = () => {
    setGeneratedLink(null);
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
              Admin Login
            </h2>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              Bitte gib dein Admin-Secret ein, um fortzufahren.
            </p>
          </div>
          <form className="mt-8 space-y-6" onSubmit={handleLogin}>
            <div>
              <label htmlFor="secret" className="sr-only">
                Admin Secret
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <Key className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="secret"
                  type="password"
                  required
                  value={adminSecret}
                  onChange={(e) => setAdminSecret(e.target.value)}
                  className="block w-full rounded-xl border border-gray-300 bg-gray-50 py-3 pr-3 pl-10 text-gray-900 transition-all outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                  placeholder="Admin Secret"
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
              className="group relative flex w-full justify-center rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 transition-all hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none"
            >
              Anmelden
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
                Admin Dashboard
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Manage access and tokens
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
                      Notiz (optional)
                    </label>
                    <input
                      type="text"
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder={"Z.B. Name des Nutzers"}
                      className="w-full rounded-xl border border-gray-300 bg-gray-50 px-4 py-3 text-gray-900 transition-all outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                    />
                  </div>
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
                entwertet und eine dauerhafte Sitzung (Grant) im Browser des
                Nutzers erstellt.
              </p>
              <ul className="list-disc space-y-2 pl-5">
                <li>Links sind nur einmal gültig.</li>
                <li>Codes werden nach der Verwendung sofort gelöscht.</li>
                <li>
                  Das Admin-Secret wird lokal verschlüsselt im Browser
                  gespeichert (Session).
                </li>
              </ul>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
