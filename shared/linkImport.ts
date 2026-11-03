/**
 * Hilfsfunktionen, um Inhalte hinter einem Link (GitHub, mdBook, Webseiten)
 * in eine Markdown-Datei zu verwandeln, die wie ein normaler Upload
 * verarbeitet wird.
 */

const BLOCKED_HOSTNAME_SUFFIXES = [".localhost", ".local", ".internal"];

const isPrivateIpv4 = (hostname: string) => {
  const match = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!match) {
    return false;
  }

  const [first, second] = [Number(match[1]), Number(match[2])];
  return (
    first === 0 ||
    first === 10 ||
    first === 127 ||
    (first === 100 && second >= 64 && second <= 127) ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168)
  );
};

/** Prüft, ob ein Link öffentlich abrufbar ist, und gibt ihn als URL zurück. */
export const parseImportUrl = (rawUrl: string) => {
  const trimmedUrl = rawUrl.trim();
  const withProtocol = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmedUrl)
    ? trimmedUrl
    : `https://${trimmedUrl}`;

  let url: URL;
  try {
    url = new URL(withProtocol);
  } catch {
    throw new Error("Das ist kein gültiger Link.");
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("Nur Links mit http:// oder https:// werden unterstützt.");
  }

  const hostname = url.hostname.toLowerCase();
  if (
    !hostname.includes(".") ||
    hostname === "localhost" ||
    hostname.startsWith("[") ||
    BLOCKED_HOSTNAME_SUFFIXES.some((suffix) => hostname.endsWith(suffix)) ||
    isPrivateIpv4(hostname)
  ) {
    throw new Error("Dieser Link ist nicht öffentlich erreichbar.");
  }

  return url;
};

const README_FILE_NAMES = ["README.md", "readme.md", "Readme.md", "README"];

/**
 * Übersetzt github.com-Links in direkt abrufbare Rohdaten-Links.
 * Repository- und Ordner-Links zeigen auf die README, Datei-Links auf die Datei.
 */
export const resolveGithubRawCandidates = (url: URL) => {
  if (url.hostname !== "github.com" && url.hostname !== "www.github.com") {
    return null;
  }

  const segments = url.pathname
    .split("/")
    .filter((segment) => segment.length > 0);
  const [owner, rawRepo, kind, ref, ...pathSegments] = segments;
  if (!owner || !rawRepo) {
    return null;
  }

  const repo = rawRepo.replace(/\.git$/, "");
  const rawBase = `https://raw.githubusercontent.com/${owner}/${repo}`;
  const path = pathSegments.join("/");

  if (kind === "blob" && ref && path) {
    return [`${rawBase}/${ref}/${path}`];
  }

  if (kind === undefined || (kind === "tree" && ref)) {
    const directory = `${rawBase}/${ref ?? "HEAD"}${path ? `/${path}` : ""}`;
    return README_FILE_NAMES.map((fileName) => `${directory}/${fileName}`);
  }

  return null;
};

/** Liefert bei einem mdBook den Link auf die Druckansicht mit allen Kapiteln. */
export const findMdBookPrintUrl = (html: string, pageUrl: string) => {
  if (!/Book generated using mdBook/i.test(html)) {
    return null;
  }

  const pathToRoot =
    html.match(/path_to_root\s*=\s*"([^"]*)"/)?.[1] ??
    html.match(/var\s+path_to_root\s*=\s*'([^']*)'/)?.[1] ??
    "";
  const printUrl = new URL(`${pathToRoot}print.html`, pageUrl);
  printUrl.hash = "";

  return printUrl.toString() === pageUrl ? null : printUrl.toString();
};

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  auml: "ä",
  ouml: "ö",
  uuml: "ü",
  Auml: "Ä",
  Ouml: "Ö",
  Uuml: "Ü",
  szlig: "ß",
  euro: "€",
  ndash: "–",
  mdash: "—",
  hellip: "…",
  laquo: "«",
  raquo: "»",
  bdquo: "„",
  ldquo: "“",
  rdquo: "”",
  lsquo: "‘",
  rsquo: "’",
  rarr: "→",
  larr: "←",
  times: "×",
  copy: "©",
};

const decodeHtmlEntities = (text: string) =>
  text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (entity, code: string) => {
    if (code.startsWith("#")) {
      const codePoint =
        code[1]?.toLowerCase() === "x"
          ? Number.parseInt(code.slice(2), 16)
          : Number.parseInt(code.slice(1), 10);
      return Number.isFinite(codePoint) && codePoint <= 0x10ffff
        ? String.fromCodePoint(codePoint)
        : entity;
    }
    return NAMED_ENTITIES[code] ?? entity;
  });

const stripTags = (html: string) => html.replace(/<[^>]*>/g, "");

const selectContentRegion = (html: string) => {
  for (const tag of ["main", "article", "body"]) {
    const match = html.match(
      new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*)</${tag}>`, "i"),
    );
    if (match?.[1]) {
      return match[1];
    }
  }
  return html;
};

export const extractHtmlTitle = (html: string) => {
  const title = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  return title ? decodeHtmlEntities(stripTags(title)).trim() || null : null;
};

/** Wandelt HTML in gut lesbares Markdown um (Überschriften, Listen, Code). */
export const htmlToMarkdown = (html: string) => {
  const codeBlocks: string[] = [];
  let content = selectContentRegion(html)
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(
      /<(script|style|noscript|svg|template|nav|header|footer|button|form|iframe)\b[\s\S]*?<\/\1>/gi,
      "",
    )
    .replace(/<pre\b[^>]*>([\s\S]*?)<\/pre>/gi, (_match, code: string) => {
      const text = decodeHtmlEntities(stripTags(code)).replace(/\n+$/, "");
      codeBlocks.push(`\`\`\`\n${text}\n\`\`\``);
      return `<p>\ue000${codeBlocks.length - 1}\ue000</p>`;
    });

  // Wie im Browser zählt Whitespace im HTML nur als einzelnes Leerzeichen.
  content = content
    .replace(/\s+/g, " ")
    .replace(
      /<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi,
      (_match, level: string, text: string) =>
        `\n\n${"#".repeat(Number(level))} ${stripTags(text).trim()}\n\n`,
    )
    .replace(/<code\b[^>]*>([\s\S]*?)<\/code>/gi, "`$1`")
    .replace(/<(strong|b)\b[^>]*>([\s\S]*?)<\/\1>/gi, "**$2**")
    .replace(/<(em|i)\b[^>]*>([\s\S]*?)<\/\1>/gi, "*$2*")
    .replace(/<li\b[^>]*>/gi, "\n- ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(td|th)>/gi, " | ")
    .replace(/<\/tr>/gi, "\n")
    .replace(/<(hr)\b[^>]*>/gi, "\n\n---\n\n")
    .replace(
      /<\/?(p|div|section|ul|ol|table|thead|tbody|blockquote|dl|dt|dd|figure|figcaption)\b[^>]*>/gi,
      "\n\n",
    );

  return decodeHtmlEntities(stripTags(content))
    .split("\n")
    .map((line) => line.replace(/[ \t\u00a0]+/g, " ").trimEnd())
    .map((line) => (line.trim() === "" ? "" : line.replace(/^ (?=\S)/, "")))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .replace(
      /\ue000(\d+)\ue000/g,
      (_match, index: string) => codeBlocks[Number(index)] ?? "",
    );
};

/** Baut einen sprechenden Dateinamen (immer .md) für importierte Inhalte. */
export const buildLinkFileName = (title: string | null, url: URL) => {
  const fallback = [url.hostname, ...url.pathname.split("/")]
    .filter((segment) => segment.length > 0 && segment !== "index.html")
    .join(" ");
  const baseName = (title || fallback || "Link")
    .replace(/\.(md|markdown|txt|html?)$/i, "")
    .replace(/[\\/:*?"<>|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 100);

  return `${baseName || "Link"}.md`;
};
