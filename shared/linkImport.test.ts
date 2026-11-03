import { describe, expect, it } from "vitest";
import {
  buildLinkFileName,
  extractHtmlTitle,
  findMdBookPrintUrl,
  htmlToMarkdown,
  parseImportUrl,
  resolveGithubRawCandidates,
} from "./linkImport";

describe("parseImportUrl", () => {
  it("adds https when the protocol is missing", () => {
    expect(parseImportUrl(" github.com/Gamius00/stackprep-mvp ").href).toBe(
      "https://github.com/Gamius00/stackprep-mvp",
    );
  });

  it.each([
    "ftp://example.com/file.md",
    "http://localhost:3000",
    "http://127.0.0.1/",
    "http://192.168.0.10/notes",
    "http://[::1]/",
    "http://intranet/",
    "kein link",
  ])("rejects %s", (url) => {
    expect(() => parseImportUrl(url)).toThrow();
  });
});

describe("resolveGithubRawCandidates", () => {
  it("points repository links at the README", () => {
    expect(
      resolveGithubRawCandidates(
        new URL("https://github.com/Gamius00/stackprep-mvp"),
      )?.[0],
    ).toBe(
      "https://raw.githubusercontent.com/Gamius00/stackprep-mvp/HEAD/README.md",
    );
  });

  it("points folder links at the README in that folder", () => {
    expect(
      resolveGithubRawCandidates(
        new URL("https://github.com/owner/repo/tree/main/docs/lf3"),
      )?.[0],
    ).toBe(
      "https://raw.githubusercontent.com/owner/repo/main/docs/lf3/README.md",
    );
  });

  it("points file links at the raw file", () => {
    expect(
      resolveGithubRawCandidates(
        new URL("https://github.com/owner/repo/blob/main/notes/lf1.md"),
      ),
    ).toEqual([
      "https://raw.githubusercontent.com/owner/repo/main/notes/lf1.md",
    ]);
  });

  it("ignores other hosts and GitHub pages it cannot read", () => {
    expect(resolveGithubRawCandidates(new URL("https://example.com/a/b"))).toBe(
      null,
    );
    expect(
      resolveGithubRawCandidates(
        new URL("https://github.com/owner/repo/issues"),
      ),
    ).toBe(null);
  });
});

describe("findMdBookPrintUrl", () => {
  const mdBookPage = (pathToRoot: string) =>
    `<!-- Book generated using mdBook --><script>const path_to_root = "${pathToRoot}";</script>`;

  it("finds the print view from the book root", () => {
    expect(
      findMdBookPrintUrl(
        mdBookPage(""),
        "https://belgarus.github.io/Notes/fi25/materialien_uebersicht/book/",
      ),
    ).toBe(
      "https://belgarus.github.io/Notes/fi25/materialien_uebersicht/book/print.html",
    );
  });

  it("finds the print view from a nested chapter", () => {
    expect(
      findMdBookPrintUrl(
        mdBookPage("../"),
        "https://example.github.io/book/kapitel/netzwerke.html",
      ),
    ).toBe("https://example.github.io/book/print.html");
  });

  it("returns null for other pages and for the print view itself", () => {
    expect(findMdBookPrintUrl("<html></html>", "https://example.com/")).toBe(
      null,
    );
    expect(
      findMdBookPrintUrl(mdBookPage(""), "https://example.com/book/print.html"),
    ).toBe(null);
  });
});

describe("htmlToMarkdown", () => {
  it("keeps the readable structure and drops page chrome", () => {
    const html = `
      <html><head><title>Ignoriert</title><style>body{}</style></head>
      <body>
        <nav>Menü</nav>
        <main>
          <h1 id="lf"><a class="header" href="#lf">Lernfeld 1</a></h1>
          <p>Das Unternehmen &amp; die <strong>Rolle</strong> im Betrieb</p>
          <ul><li><a href="https://example.com">LF1 – Zusammenfassung</a></li><li>Übung</li></ul>
          <pre><code class="language-bash">ip a
ping 10.0.0.1 &lt;- Gateway</code></pre>
          <p>Danach weiter.</p>
          <script>alert(1)</script>
        </main>
      </body></html>`;

    expect(htmlToMarkdown(html)).toBe(
      [
        "# Lernfeld 1",
        "",
        "Das Unternehmen & die **Rolle** im Betrieb",
        "",
        "- LF1 – Zusammenfassung",
        "- Übung",
        "",
        "```",
        "ip a",
        "ping 10.0.0.1 <- Gateway",
        "```",
        "",
        "Danach weiter.",
      ].join("\n"),
    );
  });
});

describe("extractHtmlTitle and buildLinkFileName", () => {
  it("uses the page title as file name", () => {
    const title = extractHtmlTitle(
      "<title>Berufsbezogener Bereich - materialien_uebersicht</title>",
    );
    expect(buildLinkFileName(title, new URL("https://example.com/"))).toBe(
      "Berufsbezogener Bereich - materialien_uebersicht.md",
    );
  });

  it("falls back to the link when there is no title", () => {
    expect(
      buildLinkFileName(
        null,
        new URL("https://github.com/Gamius00/stackprep-mvp"),
      ),
    ).toBe("github.com Gamius00 stackprep-mvp.md");
  });
});
