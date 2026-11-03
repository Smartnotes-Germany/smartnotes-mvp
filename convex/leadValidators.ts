import { v, type Infer } from "convex/values";

/** IT-Ausbildungsberufe und Studium, für die sich jemand auf stackprep.de einträgt. */
export const professionValidator = v.union(
  v.literal("fi_ae"), // Fachinformatiker:in Anwendungsentwicklung
  v.literal("fi_si"), // Fachinformatiker:in Systemintegration
  v.literal("fi_dpa"), // Fachinformatiker:in Daten- und Prozessanalyse
  v.literal("fi_dv"), // Fachinformatiker:in Digitale Vernetzung
  v.literal("itse"), // IT-System-Elektroniker:in
  v.literal("kits"), // Kaufleute für IT-System-Management
  v.literal("kdm"), // Kaufleute für Digitalisierungsmanagement
  v.literal("studium"), // Informatik-Studium
  v.literal("andere"),
);

export type Profession = Infer<typeof professionValidator>;

const professions = new Set<string>(
  professionValidator.members.map((member) => member.value),
);

export const isProfession = (value: unknown): value is Profession =>
  typeof value === "string" && professions.has(value);

/** Größenklassen statt genauer Zahlen, damit das Formular schnell ausgefüllt ist. */
export const apprenticeCountValidator = v.union(
  v.literal("1-5"),
  v.literal("6-20"),
  v.literal("21-50"),
  v.literal("50+"),
);

type ApprenticeCount = Infer<typeof apprenticeCountValidator>;

const apprenticeCounts = new Set<string>(
  apprenticeCountValidator.members.map((member) => member.value),
);

export const isApprenticeCount = (value: unknown): value is ApprenticeCount =>
  typeof value === "string" && apprenticeCounts.has(value);
