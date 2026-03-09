/* eslint-disable react-refresh/only-export-components */

import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
  pdf,
} from "@react-pdf/renderer";

type SummaryPdfDefinition = {
  term: string;
  definition: string;
};

type SummaryPdfExample = {
  title: string;
  details: string;
};

type SummaryPdfSubtopic = {
  title: string;
  description: string;
  keyPoints: string[];
  examples: SummaryPdfExample[];
};

type SummaryPdfComparisonTable = {
  title: string;
  headers: string[];
  rows: string[][];
};

type SummaryPdfTimelineEvent = {
  label: string;
  period: string;
  description: string;
};

type SummaryPdfSection = {
  title: string;
  summary: string;
  definitions: SummaryPdfDefinition[];
  subtopics: SummaryPdfSubtopic[];
  comparisonTables: SummaryPdfComparisonTable[];
};

export type SummaryPdfData = {
  title: string;
  overview: string;
  themeOverview: string[];
  timeline: SummaryPdfTimelineEvent[];
  keyTakeaways: string[];
  sections: SummaryPdfSection[];
};

const pdfStyles = StyleSheet.create({
  page: {
    paddingTop: 34,
    paddingBottom: 40,
    paddingHorizontal: 34,
    backgroundColor: "#f7f3ee",
    fontFamily: "Helvetica",
    fontSize: 10,
    color: "#1c1917",
    lineHeight: 1.45,
  },
  header: {
    marginBottom: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#d7d3cd",
  },
  eyebrow: {
    fontSize: 9,
    letterSpacing: 1.5,
    textTransform: "uppercase",
    color: "#0b617e",
    marginBottom: 6,
    fontWeight: 700,
  },
  title: {
    fontSize: 24,
    fontWeight: 700,
    lineHeight: 1.2,
    color: "#1c1917",
    marginBottom: 12,
  },
  intro: {
    fontSize: 11,
    lineHeight: 1.35,
    color: "#57534e",
  },
  metaGrid: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 16,
  },
  metaCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#d6e9ef",
    borderRadius: 14,
    padding: 12,
    backgroundColor: "#eef8fb",
  },
  metaCardWarm: {
    borderColor: "#f1ddad",
    backgroundColor: "#fff7df",
  },
  metaTitle: {
    fontSize: 8,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    fontWeight: 700,
    color: "#0b617e",
    marginBottom: 8,
  },
  metaTitleWarm: {
    color: "#9a6700",
  },
  chipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  chip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "#ffffff",
    color: "#0b617e",
    fontSize: 9,
    fontWeight: 700,
  },
  takeaway: {
    borderRadius: 12,
    backgroundColor: "#ffffff",
    padding: 10,
    fontSize: 9.5,
    color: "#365314",
    marginBottom: 7,
  },
  timelineCard: {
    borderWidth: 1,
    borderColor: "#f1ddad",
    borderRadius: 14,
    padding: 12,
    backgroundColor: "#fff7df",
    marginBottom: 14,
  },
  section: {
    borderWidth: 1,
    borderColor: "#d7d3cd",
    borderRadius: 18,
    padding: 16,
    backgroundColor: "#fffefa",
    marginBottom: 14,
  },
  sectionLabel: {
    fontSize: 8,
    textTransform: "uppercase",
    letterSpacing: 1.2,
    color: "#0b617e",
    fontWeight: 700,
    marginBottom: 6,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: 700,
    marginBottom: 8,
    color: "#1c1917",
  },
  sectionSummary: {
    fontSize: 10.5,
    color: "#57534e",
    marginBottom: 12,
  },
  blockTitle: {
    fontSize: 9,
    textTransform: "uppercase",
    letterSpacing: 1.1,
    fontWeight: 700,
    marginBottom: 8,
    color: "#0b617e",
  },
  definitionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
  },
  definitionCard: {
    width: "48%",
    borderWidth: 1,
    borderColor: "#d6e9ef",
    borderRadius: 12,
    padding: 10,
    backgroundColor: "#eef8fb",
  },
  definitionTerm: {
    fontSize: 10,
    fontWeight: 700,
    color: "#1c1917",
    marginBottom: 4,
  },
  definitionText: {
    fontSize: 9.5,
    color: "#334155",
  },
  subtopic: {
    borderWidth: 1,
    borderColor: "#e7e2dc",
    borderRadius: 14,
    padding: 12,
    backgroundColor: "#faf8f5",
    marginBottom: 10,
  },
  subtopicTitle: {
    fontSize: 12,
    fontWeight: 700,
    color: "#1c1917",
    marginBottom: 5,
  },
  subtopicDescription: {
    fontSize: 9.5,
    color: "#57534e",
    marginBottom: 8,
  },
  bulletRow: {
    flexDirection: "row",
    gap: 6,
    marginBottom: 4,
  },
  bulletDot: {
    color: "#0b617e",
    fontWeight: 700,
    width: 8,
  },
  bulletText: {
    flex: 1,
    fontSize: 9.5,
    color: "#292524",
  },
  exampleCard: {
    borderWidth: 1,
    borderColor: "#f1ddad",
    borderRadius: 12,
    padding: 10,
    backgroundColor: "#fff7df",
    marginTop: 8,
  },
  exampleTitle: {
    fontSize: 9.5,
    fontWeight: 700,
    color: "#1c1917",
    marginBottom: 4,
  },
  exampleText: {
    fontSize: 9.5,
    color: "#57534e",
  },
  tableCard: {
    borderWidth: 1,
    borderColor: "#e6d8f9",
    borderRadius: 12,
    padding: 10,
    backgroundColor: "#f8f1ff",
    marginTop: 10,
  },
  tableTitle: {
    fontSize: 10,
    fontWeight: 700,
    color: "#1c1917",
    marginBottom: 8,
  },
  tableRow: {
    flexDirection: "row",
  },
  tableHeaderCell: {
    borderBottomWidth: 1,
    borderBottomColor: "#d7bdf5",
    paddingVertical: 6,
    paddingHorizontal: 6,
    fontSize: 8.5,
    fontWeight: 700,
    color: "#5b21b6",
  },
  tableCell: {
    borderBottomWidth: 1,
    borderBottomColor: "#eadcf8",
    paddingVertical: 6,
    paddingHorizontal: 6,
    fontSize: 8.5,
    color: "#3f3f46",
  },
  footer: {
    position: "absolute",
    bottom: 18,
    left: 34,
    right: 34,
    fontSize: 8,
    color: "#78716c",
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "#d7d3cd",
    paddingTop: 6,
  },
});

function SummaryPdfTable({ table }: { table: SummaryPdfComparisonTable }) {
  const columnWidth = `${100 / table.headers.length}%`;

  return (
    <View style={pdfStyles.tableCard} wrap={false}>
      <Text style={pdfStyles.tableTitle}>{table.title}</Text>
      <View>
        <View style={pdfStyles.tableRow}>
          {table.headers.map((header, index) => (
            <Text
              key={`${table.title}-header-${index}`}
              style={{ ...pdfStyles.tableHeaderCell, width: columnWidth }}
            >
              {header}
            </Text>
          ))}
        </View>
        {table.rows.map((row, rowIndex) => (
          <View
            key={`${table.title}-row-${rowIndex}`}
            style={pdfStyles.tableRow}
          >
            {row.map((cell, cellIndex) => (
              <Text
                key={`${table.title}-${rowIndex}-${cellIndex}`}
                style={{ ...pdfStyles.tableCell, width: columnWidth }}
              >
                {cell}
              </Text>
            ))}
          </View>
        ))}
      </View>
    </View>
  );
}

function SummaryPdfDocument({ summary }: { summary: SummaryPdfData }) {
  return (
    <Document title={summary.title} author="Smartnotes">
      <Page size="A4" style={pdfStyles.page} wrap>
        <View style={pdfStyles.header}>
          <Text style={pdfStyles.eyebrow}>Smartnotes Lernübersicht</Text>
          <Text style={pdfStyles.title}>{summary.title}</Text>
          <Text style={pdfStyles.intro}>{summary.overview}</Text>
        </View>

        <View style={pdfStyles.metaGrid}>
          <View style={pdfStyles.metaCard}>
            <Text style={pdfStyles.metaTitle}>Themenübersicht</Text>
            <View style={pdfStyles.chipWrap}>
              {summary.themeOverview.map((topic, index) => (
                <Text key={`theme-${index}`} style={pdfStyles.chip}>
                  {topic}
                </Text>
              ))}
            </View>
          </View>

          <View style={{ ...pdfStyles.metaCard, ...pdfStyles.metaCardWarm }}>
            <Text
              style={{ ...pdfStyles.metaTitle, ...pdfStyles.metaTitleWarm }}
            >
              Merksätze
            </Text>
            <View>
              {summary.keyTakeaways.map((item, index) => (
                <Text key={`takeaway-${index}`} style={pdfStyles.takeaway}>
                  {item}
                </Text>
              ))}
            </View>
          </View>
        </View>

        {summary.timeline.length > 0 ? (
          <View style={pdfStyles.timelineCard}>
            <Text style={{ ...pdfStyles.blockTitle, color: "#9a6700" }}>
              Zeitliche Einordnung
            </Text>
            {summary.timeline.map((event, index) => (
              <View key={`timeline-${index}`} style={{ marginBottom: 8 }}>
                <Text
                  style={{ fontSize: 10, fontWeight: 700, marginBottom: 2 }}
                >
                  {event.label} - {event.period}
                </Text>
                <Text style={{ fontSize: 9.5, color: "#57534e" }}>
                  {event.description}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        {summary.sections.map((section, sectionIndex) => (
          <View key={`section-${sectionIndex}`} style={pdfStyles.section}>
            <Text style={pdfStyles.sectionLabel}>Themenblock</Text>
            <Text style={pdfStyles.sectionTitle}>{section.title}</Text>
            <Text style={pdfStyles.sectionSummary}>{section.summary}</Text>

            {section.definitions.length > 0 ? (
              <View>
                <Text style={pdfStyles.blockTitle}>Begriffsdefinitionen</Text>
                <View style={pdfStyles.definitionGrid}>
                  {section.definitions.map((definition, definitionIndex) => (
                    <View
                      key={`definition-${sectionIndex}-${definitionIndex}`}
                      style={pdfStyles.definitionCard}
                    >
                      <Text style={pdfStyles.definitionTerm}>
                        {definition.term}
                      </Text>
                      <Text style={pdfStyles.definitionText}>
                        {definition.definition}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}

            {section.subtopics.map((subtopic, subtopicIndex) => (
              <View
                key={`subtopic-${sectionIndex}-${subtopicIndex}`}
                style={pdfStyles.subtopic}
                wrap={false}
              >
                <Text style={pdfStyles.subtopicTitle}>{subtopic.title}</Text>
                <Text style={pdfStyles.subtopicDescription}>
                  {subtopic.description}
                </Text>

                {subtopic.keyPoints.map((point, pointIndex) => (
                  <View
                    key={`point-${sectionIndex}-${subtopicIndex}-${pointIndex}`}
                    style={pdfStyles.bulletRow}
                  >
                    <Text style={pdfStyles.bulletDot}>•</Text>
                    <Text style={pdfStyles.bulletText}>{point}</Text>
                  </View>
                ))}

                {subtopic.examples.map((example, exampleIndex) => (
                  <View
                    key={`example-${sectionIndex}-${subtopicIndex}-${exampleIndex}`}
                    style={pdfStyles.exampleCard}
                  >
                    <Text style={pdfStyles.exampleTitle}>{example.title}</Text>
                    <Text style={pdfStyles.exampleText}>{example.details}</Text>
                  </View>
                ))}
              </View>
            ))}

            {section.comparisonTables.map((table, tableIndex) => (
              <SummaryPdfTable
                key={`table-${sectionIndex}-${tableIndex}`}
                table={table}
              />
            ))}
          </View>
        ))}

        <View style={pdfStyles.footer} fixed>
          <Text>Smartnotes</Text>
          <Text
            render={({ pageNumber, totalPages }) =>
              `${pageNumber} / ${totalPages}`
            }
          />
        </View>
      </Page>
    </Document>
  );
}

export async function downloadSummaryPdf(
  summary: SummaryPdfData,
  fileName: string,
) {
  const blob = await pdf(<SummaryPdfDocument summary={summary} />).toBlob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = fileName;
  link.click();

  window.setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 0);
}
