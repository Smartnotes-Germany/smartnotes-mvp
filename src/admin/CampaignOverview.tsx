import { useQuery } from "convex/react";
import { BarChart3, Building2 } from "lucide-react";
import { api } from "../../convex/_generated/api";
import type { Profession } from "../../convex/leadValidators";

const PROFESSION_LABELS: Record<Profession, string> = {
  fi_ae: "FI Anwendungsentwicklung",
  fi_si: "FI Systemintegration",
  fi_dpa: "FI Daten- und Prozessanalyse",
  fi_dv: "FI Digitale Vernetzung",
  itse: "IT-System-Elektroniker:in",
  kits: "Kaufleute für IT-System-Management",
  kdm: "Kaufleute für Digitalisierungsmanagement",
  studium: "Informatik-Studium",
  andere: "Etwas anderes",
};

const dateFormatter = new Intl.DateTimeFormat("de-DE", {
  dateStyle: "medium",
  timeStyle: "short",
});

const percent = (part: number, total: number) =>
  total > 0 ? `${Math.round((part / total) * 100)} %` : "–";

const cardClassName =
  "rounded-2xl border border-gray-100 bg-white p-8 shadow-sm dark:border-gray-800 dark:bg-gray-900";
const headCellClassName =
  "px-3 py-2 text-left text-xs font-semibold tracking-wide text-gray-500 uppercase dark:text-gray-400";
const cellClassName = "px-3 py-2 text-sm text-gray-700 dark:text-gray-300";

/** Zeigt, wie viele Besuche, Anmeldungen und Betriebsanfragen über welche Quelle kamen. */
export default function CampaignOverview({
  adminSecret,
}: {
  adminSecret: string;
}) {
  const overview = useQuery(api.campaigns.overview, { adminSecret });

  if (overview === undefined) {
    return (
      <section className={cardClassName}>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Lade Auswertung …
        </p>
      </section>
    );
  }

  return (
    <>
      <section className={cardClassName}>
        <h2 className="mb-2 flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-white">
          <BarChart3 className="h-5 w-5 text-blue-600" />
          Herkunft der Anmeldungen
        </h2>
        <p className="mb-6 text-sm text-gray-500 dark:text-gray-400">
          Seit {overview.fromDay}. Besuche zählen nur über Links mit Quelle, zum
          Beispiel
          <code className="mx-1 rounded bg-gray-100 px-1 dark:bg-gray-800">
            stackprep.de/?utm_source=linkedin&utm_campaign=launch
          </code>
          oder mit LinkedIn als Referrer.
        </p>

        {overview.bySource.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Noch keine Daten.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[36rem]">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-800">
                  <th className={headCellClassName}>Quelle</th>
                  <th className={headCellClassName}>Kampagne</th>
                  <th className={headCellClassName}>Besuche</th>
                  <th className={headCellClassName}>Anmeldungen</th>
                  <th className={headCellClassName}>Bestätigt</th>
                  <th className={headCellClassName}>Betriebe</th>
                </tr>
              </thead>
              <tbody>
                {overview.bySource.map((row) => (
                  <tr
                    key={`${row.source}/${row.campaign}`}
                    className="border-b border-gray-50 last:border-0 dark:border-gray-800/60"
                  >
                    <td className={`${cellClassName} font-medium`}>
                      {row.source}
                    </td>
                    <td className={cellClassName}>{row.campaign || "–"}</td>
                    <td className={cellClassName}>{row.visits}</td>
                    <td className={cellClassName}>
                      {row.signups}
                      {row.visits > 0 && (
                        <span className="ml-1 text-xs text-gray-400">
                          ({percent(row.signups, row.visits)})
                        </span>
                      )}
                    </td>
                    <td className={cellClassName}>{row.confirmations}</td>
                    <td className={cellClassName}>{row.companyInquiries}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {overview.byDay.length > 0 && (
          <>
            <h3 className="mt-8 mb-3 text-sm font-semibold text-gray-900 dark:text-white">
              Pro Tag
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[30rem]">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-800">
                    <th className={headCellClassName}>Tag</th>
                    <th className={headCellClassName}>Besuche</th>
                    <th className={headCellClassName}>Anmeldungen</th>
                    <th className={headCellClassName}>Bestätigt</th>
                    <th className={headCellClassName}>Betriebe</th>
                  </tr>
                </thead>
                <tbody>
                  {overview.byDay.slice(0, 14).map((row) => (
                    <tr
                      key={row.day}
                      className="border-b border-gray-50 last:border-0 dark:border-gray-800/60"
                    >
                      <td className={`${cellClassName} font-medium`}>
                        {row.day}
                      </td>
                      <td className={cellClassName}>{row.visits}</td>
                      <td className={cellClassName}>{row.signups}</td>
                      <td className={cellClassName}>{row.confirmations}</td>
                      <td className={cellClassName}>{row.companyInquiries}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {overview.professions.length > 0 && (
          <>
            <h3 className="mt-8 mb-3 text-sm font-semibold text-gray-900 dark:text-white">
              Ausbildungsberufe (letzte {overview.professionSampleSize}{" "}
              Anmeldungen)
            </h3>
            <ul className="flex flex-wrap gap-2">
              {overview.professions.map(({ profession, count }) => (
                <li
                  key={profession}
                  className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-sm text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
                >
                  {PROFESSION_LABELS[profession]}: <strong>{count}</strong>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <section className={cardClassName}>
        <h2 className="mb-6 flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-white">
          <Building2 className="h-5 w-5 text-blue-600" />
          Anfragen von Betrieben
        </h2>
        {overview.companyInquiries.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Noch keine Anfragen.
          </p>
        ) : (
          <ul className="space-y-3">
            {overview.companyInquiries.map((inquiry) => (
              <li
                key={inquiry.id}
                className="rounded-xl border border-gray-100 p-4 dark:border-gray-800"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-semibold text-gray-900 dark:text-white">
                    {inquiry.companyName}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {dateFormatter.format(inquiry.createdAt)} · über{" "}
                    {inquiry.source}
                    {inquiry.campaign ? ` / ${inquiry.campaign}` : ""}
                  </p>
                </div>
                <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">
                  <a
                    href={`mailto:${inquiry.email}`}
                    className="text-blue-600 hover:underline dark:text-blue-400"
                  >
                    {inquiry.email}
                  </a>{" "}
                  · {inquiry.apprenticeCount} Azubis
                </p>
                {inquiry.professions && (
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    {inquiry.professions}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
