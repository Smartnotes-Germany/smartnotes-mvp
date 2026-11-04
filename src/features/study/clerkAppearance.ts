import type { ClerkProviderProps } from "@clerk/react";

/**
 * Clerk-Komponenten übernehmen die App-Tokens aus index.css, dadurch folgen
 * sie auch dem Dark Mode. Die Karte selbst liefert unser `sp-card`.
 */
export const clerkAppearance = {
  // Mit Layer überschreiben die Tailwind-Klassen unten Clerks eigene Styles.
  cssLayerName: "clerk",
  variables: {
    colorPrimary: "var(--color-action)",
    colorPrimaryForeground: "#ffffff",
    colorForeground: "var(--color-ink)",
    colorMutedForeground: "var(--color-ink-muted)",
    colorBackground: "transparent",
    colorInput: "var(--color-cream-light)",
    colorInputForeground: "var(--color-ink)",
    colorBorder: "var(--color-cream-border)",
    colorNeutral: "var(--color-ink)",
    colorDanger: "#dc2626",
    fontFamily: "var(--font-sans)",
    borderRadius: "0.875rem",
  },
  elements: {
    rootBox: "w-full",
    // Ohne Kopfzeile steht das erste Label direkt in der Ecke der cardBox. Mit
    // runden Ecken würde ihr overflow: hidden den ersten Buchstaben abschneiden.
    cardBox: "w-full max-w-none rounded-none border-0 shadow-none",
    // Clerk rückt die Karte um -1px über den Rahmen der cardBox. Ohne Rahmen
    // schneidet die cardBox sonst den Rand der Felder ab.
    card: "m-0 bg-transparent p-0 shadow-none",
    headerTitle: "text-2xl font-medium tracking-[-0.04em]",
    formButtonPrimary: "min-h-11 rounded-full text-[0.9375rem] font-semibold",
    socialButtonsBlockButton: "min-h-11 rounded-full",
    // Statt Clerks grauem Fokus-Ring wie das Zugangscode-Feld: blauer Rahmen.
    formFieldInput:
      "border-cream-border focus:border-accent min-h-11 rounded-full border px-4 shadow-none",
    // Clerk blendet den Rahmen der Code-Felder aus colorBorder ab. Im Dark Mode
    // ist der schon halbtransparent, dann verschwinden die Felder fast.
    otpCodeFieldInput:
      "border-cream-border bg-cream-light text-ink border shadow-none data-[focus-within=true]:border-accent aria-[invalid=true]:border-red-500",
    footer: "bg-none bg-transparent",
  },
} satisfies ClerkProviderProps["appearance"];
