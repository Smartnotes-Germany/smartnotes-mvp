import { useState, useEffect } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Key, Check, LogOut, Plus } from "lucide-react";
import logoImage from "../assets/images/logo.png";

export default function AdminDashboard() {
  const [adminSecret, setAdminSecret] = useState(() => localStorage.getItem("adminSecret") || "");
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [note, setNote] = useState("");

  const verifySecret = useQuery(api.admin.verifySecret, { adminSecret });
  const generateMagicLink = useMutation(api.admin.generateMagicLink);

  const [isAuthorized, setIsAuthorized] = useState(verifySecret?.valid ?? false);
  const loginError = verifySecret && !verifySecret.valid && adminSecret ? "Ungültiges Admin-Secret." : "";

  useEffect(() => {
    if (isAuthorized) {
      localStorage.setItem("adminSecret", adminSecret);
    }
  }, [isAuthorized, adminSecret]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setIsAuthorized(true)
  };

  const handleLogout = () => {
    setAdminSecret("");
    setIsAuthorized(false);
    localStorage.removeItem("adminSecret");
  };

  const handleGenerateLink = async () => {
    try {
      const { code } = await generateMagicLink({ adminSecret, note });
      const magicLink = `${window.location.origin}/?code=${code}`;
      await navigator.clipboard.writeText(magicLink);
      setCopiedCode(code);
      setNote("");
      setTimeout(() => setCopiedCode(null), 3000);
    } catch (err) {
      console.error(err);
      alert("Fehler beim Generieren des Links.");
    }
  };

  if (!isAuthorized) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-4 dark:bg-gray-950">
        <div className="w-full max-w-md space-y-8 rounded-2xl bg-white p-8 shadow-xl dark:bg-gray-900 border border-gray-100 dark:border-gray-800">
          <div className="text-center">
            <img src={logoImage} alt="SmartNotes" className="mx-auto rounded-xl h-12 w-auto mb-4" />
            <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white flex items-center justify-center gap-2">
              Admin Login
            </h2>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              Bitte gib dein Admin-Secret ein, um fortzufahren.
            </p>
          </div>
          <form className="mt-8 space-y-6" onSubmit={handleLogin}>
            <div>
              <label htmlFor="secret" className="sr-only">Admin Secret</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                  <Key className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="secret"
                  type="password"
                  required
                  value={adminSecret}
                  onChange={(e) => setAdminSecret(e.target.value)}
                  className="block w-full pl-10 pr-3 py-3 border border-gray-300 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none"
                  placeholder="Admin Secret"
                />
              </div>
            </div>
            {loginError && (
              <p className="text-sm text-red-600 dark:text-red-400 text-center">{loginError}</p>
            )}
            <button
              type="submit"
              className="group relative flex w-full justify-center rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all shadow-lg shadow-blue-500/20"
            >
              Anmelden
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-4 sm:p-8">
      <div className="mx-auto max-w-4xl">
        <header className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-8 bg-white dark:bg-gray-900 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-4">
            <img src={logoImage} alt="SmartNotes" className="h-10 w-auto" />
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">Admin Dashboard</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">Manage access and tokens</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Abmelden
          </button>
        </header>

        <main className="space-y-6">
          <section className="bg-white dark:bg-gray-900 p-8 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800">
            <h2 className="text-lg font-semibold mb-6 flex items-center gap-2 text-gray-900 dark:text-white">
              <Plus className="w-5 h-5 text-blue-600" />
              Magic Link erstellen
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Notiz (optional)
                </label>
                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Z.B. 'Für Testnutzer X'"
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                />
              </div>
              <button
                onClick={handleGenerateLink}
                className="w-full sm:w-auto px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl shadow-lg shadow-blue-500/20 transition-all flex items-center justify-center gap-2"
              >
                {copiedCode ? <Check className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                {copiedCode ? "Kopiert!" : "Link generieren & kopieren"}
              </button>
              {copiedCode && (
                <p className="text-sm text-green-600 dark:text-green-400 mt-2 animate-pulse">
                  Magic Link wurde in die Zwischenablage kopiert! (Code: {copiedCode})
                </p>
              )}
            </div>
          </section>

          <section className="bg-white dark:bg-gray-900 p-8 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Hilfe & Infos</h2>
            </div>
            <div className="prose prose-sm dark:prose-invert max-w-none text-gray-600 dark:text-gray-400">
              <p>
                Der Magic Link enthält einen einmalig verwendbaren Zugangscode. 
                Sobald der Nutzer den Link öffnet, wird der Code im Backend entwertet und eine dauerhafte Sitzung (Grant) im Browser des Nutzers erstellt.
              </p>
              <ul className="list-disc pl-5 space-y-2">
                <li>Links sind nur einmal gültig.</li>
                <li>Codes werden nach der Verwendung sofort gelöscht.</li>
                <li>Das Admin-Secret wird lokal verschlüsselt im Browser gespeichert (Session).</li>
              </ul>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
