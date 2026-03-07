import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  PDFViewer,
} from "@react-pdf/renderer";
import { ArrowLeft, Sparkles } from "lucide-react";

// Register a nice font if needed, but standard ones are fine for now
// Font.register({ family: 'Inter', src: '...' });

const styles = StyleSheet.create({
  page: {
    padding: 40,
    backgroundColor: "#ffffff",
    fontFamily: "Helvetica",
  },
  header: {
    marginBottom: 30,
    borderBottom: "1.5pt solid #2563eb",
    paddingBottom: 15,
  },
  title: {
    fontSize: 26,
    fontWeight: "bold",
    color: "#0f172a",
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 10,
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  section: {
    marginBottom: 25,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#2563eb",
    marginBottom: 12,
  },
  content: {
    fontSize: 11,
    lineHeight: 1.6,
    color: "#334155",
    marginBottom: 6,
  },
  bulletPoint: {
    flexDirection: "row",
    marginBottom: 4,
  },
  bullet: {
    width: 15,
    fontSize: 11,
    color: "#2563eb",
  },
  footer: {
    position: "absolute",
    bottom: 30,
    left: 40,
    right: 40,
    fontSize: 9,
    color: "#94a3b8",
    textAlign: "center",
    borderTop: "0.5pt solid #e2e8f0",
    paddingTop: 15,
  },
});

type PdfSummaryData = {
  title: string;
  sections: Array<{
    title: string;
    content: string;
  }>;
};

const MyDocument = ({ data }: { data: PdfSummaryData }) => (
  <Document title={data.title}>
    <Page size="A4" style={styles.page}>
      <View style={styles.header}>
        <Text style={styles.title}>{data.title}</Text>
      </View>

      {data.sections.map((section, index) => (
        <View key={index} style={styles.section} wrap={false}>
          <Text style={styles.sectionTitle}>{section.title}</Text>
          <View>
            {section.content.split("\n").map((point, i) => (
              <View key={i} style={styles.bulletPoint}>
                <Text style={styles.bullet}>•</Text>
                <Text style={styles.content}>{point}</Text>
              </View>
            ))}
          </View>
        </View>
      ))}

      <Text style={styles.footer}>
        Professionell aufbereitet mit Smartnotes •{" "}
        {new Date().toLocaleDateString("de-DE")}
      </Text>
    </Page>
  </Document>
);

type PdfSummaryStageProps = {
  data: PdfSummaryData | undefined;
  onBack: () => void;
  onContinueToQuiz: () => void;
};

export function PdfSummaryStage({
  data,
  onBack,
  onContinueToQuiz,
}: PdfSummaryStageProps) {
  if (!data) {
    return (
      <div className="flex h-[70vh] flex-col items-center justify-center space-y-6">
        <div className="relative">
          <div className="border-accent/10 border-t-accent h-20 w-20 animate-spin rounded-full border-4" />
          <Sparkles
            className="text-accent absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
            size={32}
          />
        </div>
        <div className="text-center">
          <h3 className="text-ink text-xl font-bold">
            Zusammenfassung wird generiert
          </h3>
          <p className="text-ink-muted mt-1 text-sm font-medium">
            Deine Unterlagen werden strukturiert aufbereitet...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-cream animate-in fade-in fixed inset-0 z-50 flex flex-col duration-500 lg:left-[300px]">
      {/* Sleek Header */}
      <div className="bg-surface-white border-cream-border flex items-center justify-between border-b px-6 py-4 shadow-sm">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="hover:bg-cream-light text-ink-muted rounded-xl p-2 transition-all active:scale-90"
            title="Zurück"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-ink text-xl leading-none font-black tracking-tight">
              Lernübersicht
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onContinueToQuiz}
            className="bg-accent shadow-accent/20 flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-bold text-white shadow-lg transition-all hover:-translate-y-0.5 hover:opacity-90 active:scale-95"
          >
            Wissen testen <Sparkles size={16} />
          </button>
        </div>
      </div>

      {/* Main Viewer - Pure Focus, No Margins */}
      <div className="bg-cream flex-1 overflow-hidden">
        <PDFViewer
          width="100%"
          height="100%"
          className="border-none"
          showToolbar={true}
        >
          <MyDocument data={data} />
        </PDFViewer>
      </div>
    </div>
  );
}
