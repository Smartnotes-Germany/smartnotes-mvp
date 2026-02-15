"use node";

import { generateText, Output } from "ai";
import { createVertex } from "@ai-sdk/google-vertex";
import { parseOffice } from "officeparser";
import { z } from "zod";
import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";

const MAX_EXTRACTED_TEXT_CHARS = 120_000;
const MAX_PROMPT_CONTEXT_CHARS = 90_000;

const plainTextExtensions = new Set(["txt", "md", "markdown", "csv", "json", "yaml", "yml"]);
const vertexNativeFileExtensions = new Set(["pdf", "ppt", "pptx", "doc", "docx"]);
const vertexNativeMediaTypes = new Set([
  "application/pdf",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

const extensionToMediaType: Record<string, string> = {
  pdf: "application/pdf",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

const quizGenerationSchema = z.object({
  sourceSummary: z.string(),
  topics: z.array(z.string()).min(3).max(12),
  questions: z.array(
    z.object({
      topic: z.string(),
      prompt: z.string(),
      idealAnswer: z.string(),
      explanationHint: z.string(),
    }),
  ),
});

const answerEvaluationSchema = z.object({
  isCorrect: z.boolean(),
  score: z.number().min(0).max(100),
  explanation: z.string(),
  idealAnswer: z.string(),
});

const analysisSchema = z.object({
  overallReadiness: z.number().min(0).max(100),
  strongestTopics: z.array(z.string()).min(1).max(3),
  weakestTopics: z.array(z.string()).min(1).max(3),
  topics: z.array(
    z.object({
      topic: z.string(),
      comfortScore: z.number().min(0).max(100),
      rationale: z.string(),
      recommendation: z.string(),
    }),
  ),
  recommendedNextStep: z.string(),
});

const deepDiveSchema = z.object({
  sourceSummary: z.string(),
  topics: z.array(z.string()).min(1).max(10),
  questions: z.array(
    z.object({
      topic: z.string(),
      prompt: z.string(),
      idealAnswer: z.string(),
      explanationHint: z.string(),
    }),
  ),
});

type SessionDocumentInput = {
  storageId: string;
  fileName: string;
  fileType: string;
  extractedText?: string;
  extractionStatus: "pending" | "processing" | "ready" | "failed";
};

type QuestionForEvaluation = {
  id: string;
  topic: string;
  prompt: string;
  idealAnswer: string;
  explanationHint: string;
};

type QuizGenerationResult = z.infer<typeof quizGenerationSchema>;
type AnswerEvaluationResult = z.infer<typeof answerEvaluationSchema>;
type AnalysisResult = z.infer<typeof analysisSchema>;
type DeepDiveGenerationResult = z.infer<typeof deepDiveSchema>;

const compactText = (value: string, maxChars: number) => {
  const normalized = value.replace(/\r/g, "").replace(/\t/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  if (normalized.length <= maxChars) {
    return normalized;
  }
  return `${normalized.slice(0, maxChars)}\n\n[Inhalt wurde fuer die Verarbeitung gekuerzt.]`;
};

const filenameExtension = (name: string) => {
  const parts = name.toLowerCase().split(".");
  if (parts.length < 2) {
    return "";
  }
  return parts[parts.length - 1] ?? "";
};

const decodeUtf8 = (buffer: Buffer) => new TextDecoder("utf-8").decode(buffer);

const isVertexNativeCandidate = (fileType: string, fileName: string) => {
  const extension = filenameExtension(fileName);
  return vertexNativeMediaTypes.has(fileType) || vertexNativeFileExtensions.has(extension);
};

const resolveMediaType = (fileType: string, fileName: string) => {
  if (fileType && fileType !== "application/octet-stream") {
    return fileType;
  }
  const extension = filenameExtension(fileName);
  return extensionToMediaType[extension] ?? "application/octet-stream";
};

const createVertexModel = () => {
  const apiKey = process.env.GOOGLE_VERTEX_API_KEY;
  if (apiKey) {
    return createVertex({ apiKey });
  }

  const project = process.env.GOOGLE_VERTEX_PROJECT;
  if (!project) {
    throw new Error(
      "Konfiguriere GOOGLE_VERTEX_API_KEY (Express Mode) oder GOOGLE_VERTEX_PROJECT + GOOGLE_VERTEX_LOCATION.",
    );
  }

  return createVertex({
    project,
    location: process.env.GOOGLE_VERTEX_LOCATION ?? "us-central1",
  });
};

const extractTextFromBytes = async (fileName: string, fileType: string, fileBuffer: Buffer) => {
  const extension = filenameExtension(fileName);

  if (fileType.startsWith("text/") || plainTextExtensions.has(extension)) {
    return compactText(decodeUtf8(fileBuffer), MAX_EXTRACTED_TEXT_CHARS);
  }

  const parsedAst = await parseOffice(fileBuffer, {
    newlineDelimiter: "\n",
    ignoreNotes: false,
  });
  return compactText(parsedAst.toText(), MAX_EXTRACTED_TEXT_CHARS);
};

const buildSourceContext = (documents: Array<{ fileName: string; extractedText?: string }>) => {
  const sections: string[] = [];
  for (const [index, document] of documents.entries()) {
    if (!document.extractedText) {
      continue;
    }
    sections.push(`Dokument ${index + 1}: ${document.fileName}\n${document.extractedText}`);
  }

  return compactText(sections.join("\n\n---\n\n"), MAX_PROMPT_CONTEXT_CHARS);
};

const buildModelInputFromDocuments = async <TStorageId>(
  ctx: { storage: { getUrl: (storageId: TStorageId) => Promise<string | null> } },
  documents: Array<{
    storageId: TStorageId;
    fileName: string;
    fileType: string;
    extractedText?: string;
  }>,
) => {
  const fileParts: Array<{
    type: "file";
    data: Buffer;
    mediaType: string;
    filename: string;
  }> = [];
  const textOnlyDocuments: Array<{ fileName: string; extractedText?: string }> = [];

  for (const document of documents) {
    if (isVertexNativeCandidate(document.fileType, document.fileName)) {
      const fileUrl = await ctx.storage.getUrl(document.storageId);
      if (!fileUrl) {
        if (document.extractedText) {
          textOnlyDocuments.push({ fileName: document.fileName, extractedText: document.extractedText });
          continue;
        }
        throw new Error(`Datei konnte nicht gelesen werden: ${document.fileName}`);
      }

      const response = await fetch(fileUrl);
      if (!response.ok) {
        if (document.extractedText) {
          textOnlyDocuments.push({ fileName: document.fileName, extractedText: document.extractedText });
          continue;
        }
        throw new Error(`Datei-Download fehlgeschlagen (${response.status}) fuer ${document.fileName}`);
      }

      fileParts.push({
        type: "file",
        data: Buffer.from(await response.arrayBuffer()),
        mediaType: resolveMediaType(document.fileType, document.fileName),
        filename: document.fileName,
      });
      continue;
    }

    if (document.extractedText) {
      textOnlyDocuments.push({ fileName: document.fileName, extractedText: document.extractedText });
    }
  }

  return {
    fileParts,
    sourceContext: buildSourceContext(textOnlyDocuments),
  };
};

const buildFallbackAnalysis = (
  responses: Array<{ topic: string; score: number }>,
  focusTopic?: string,
) => {
  const grouped = new Map<string, number[]>();
  for (const response of responses) {
    const current = grouped.get(response.topic) ?? [];
    current.push(response.score);
    grouped.set(response.topic, current);
  }

  const topics = [...grouped.entries()].map(([topic, scores]) => {
    const average = scores.reduce((total, value) => total + value, 0) / Math.max(scores.length, 1);
    const comfortScore = Math.round(Math.max(0, Math.min(100, average)));
    const rationale =
      comfortScore >= 75
        ? "Sehr sichere Wissensabfrage mit praezisen Antworten."
        : comfortScore >= 50
          ? "Gemischte Leistung. Teile des Themas sitzen, aber es braucht mehr Wiederholung."
          : "Hier besteht deutlicher Lernbedarf. Konzentriere dich auf Grundkonzepte und kurze Active-Recall-Runden.";

    return {
      topic,
      comfortScore,
      rationale,
      recommendation:
        comfortScore >= 75
          ? "Mit kurzer Spaced Repetition stabil halten."
          : comfortScore >= 50
            ? "Mache eine gezielte Vertiefung mit 5-10 Abruffragen."
            : "Starte eine gefuehrte Vertiefung und wiederhole zuerst die Grundlagen.",
    };
  });

  topics.sort((a, b) => a.comfortScore - b.comfortScore);

  const overallReadiness = topics.length
    ? Math.round(topics.reduce((total, topic) => total + topic.comfortScore, 0) / topics.length)
    : 0;

  return {
    overallReadiness,
    strongestTopics: topics.slice(-3).reverse().map((topic) => topic.topic),
    weakestTopics: topics.slice(0, 3).map((topic) => topic.topic),
    topics,
    recommendedNextStep: focusTopic
      ? `Starte eine Vertiefung zu ${focusTopic} mit gezielten Uebungsfragen.`
      : "Waehle dein schwaechstes Thema und beginne eine fokussierte Vertiefung.",
  };
};

export const extractDocumentContent = action({
  args: {
    grantToken: v.string(),
    sessionId: v.id("studySessions"),
    documentId: v.id("sessionDocuments"),
  },
  handler: async (ctx, args) => {
    await ctx.runMutation(internal.study.setDocumentExtractionResult, {
      documentId: args.documentId,
      extractionStatus: "processing",
    });

    const { document } = await ctx.runQuery(internal.study.getDocumentExtractionContext, {
      grantToken: args.grantToken,
      sessionId: args.sessionId,
      documentId: args.documentId,
    });

    // Hybrid approach:
    // - Native Vertex file path for PDF/Slides/Word formats.
    // - officeparser/text extraction fallback for all other formats.
    if (isVertexNativeCandidate(document.fileType, document.fileName)) {
      await ctx.runMutation(internal.study.setDocumentExtractionResult, {
        documentId: args.documentId,
        extractionStatus: "ready",
      });

      return {
        documentId: args.documentId,
        extractionStatus: "ready" as const,
      };
    }

    try {
      const fileUrl = await ctx.storage.getUrl(document.storageId);
      if (!fileUrl) {
        throw new Error("Auf das hochgeladene Dokument kann nicht zugegriffen werden.");
      }

      const response = await fetch(fileUrl);
      if (!response.ok) {
        throw new Error(`Datei-Download fehlgeschlagen: ${response.status}`);
      }

      const fileBuffer = Buffer.from(await response.arrayBuffer());
      const extractedText = await extractTextFromBytes(document.fileName, document.fileType, fileBuffer);

      if (!extractedText) {
        throw new Error("Aus dieser Datei konnte kein Text extrahiert werden.");
      }

      await ctx.runMutation(internal.study.setDocumentExtractionResult, {
        documentId: args.documentId,
        extractionStatus: "ready",
        extractedText,
      });

      return {
        documentId: args.documentId,
        extractionStatus: "ready" as const,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unbekannter Fehler bei der Extraktion.";

      await ctx.runMutation(internal.study.setDocumentExtractionResult, {
        documentId: args.documentId,
        extractionStatus: "failed",
        extractionError: message,
      });

      return {
        documentId: args.documentId,
        extractionStatus: "failed" as const,
        error: message,
      };
    }
  },
});

export const generateQuiz = action({
  args: {
    grantToken: v.string(),
    sessionId: v.id("studySessions"),
    questionCount: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const desiredCount = Math.max(3, Math.min(10, Math.floor(args.questionCount ?? 6)));

    const quizContext: { documents: SessionDocumentInput[] } = await ctx.runQuery(internal.study.getQuizGenerationContext, {
      grantToken: args.grantToken,
      sessionId: args.sessionId,
    });

    const documents = quizContext.documents;

    const readyDocuments = documents.filter(
      (document: SessionDocumentInput) => document.extractionStatus === "ready",
    );
    if (readyDocuments.length === 0) {
      throw new Error("Lade mindestens ein Dokument hoch und verarbeite es, bevor du Quizfragen generierst.");
    }

    const model = createVertexModel();
    const { fileParts, sourceContext } = await buildModelInputFromDocuments(
      ctx,
      readyDocuments.map((document: SessionDocumentInput) => ({
        storageId: document.storageId,
        fileName: document.fileName,
        fileType: document.fileType,
        extractedText: document.extractedText,
      })),
    );

    if (fileParts.length === 0 && !sourceContext) {
      throw new Error("Es konnten keine nutzbaren Inhalte aus den hochgeladenen Dateien gelesen werden.");
    }

    const userContent: Array<
      | { type: "text"; text: string }
      | { type: "file"; data: Buffer; mediaType: string; filename: string }
    > = [
      {
        type: "text",
        text: `Erstelle ${desiredCount} kurze, prufungsnahe Fragen auf Basis des bereitgestellten Lernmaterials.

Anforderungen:
- Fragen sollen zu wahrscheinlichen Klausur-/Testfragen passen.
- Mische konzeptionelles Verstaendnis und Faktenabfrage.
- Antworthinweise muessen fachlich korrekt und konkret sein.
- Gib eine kurze Hilfezeile fuer den Fall einer falschen Antwort.`,
      },
    ];

    if (sourceContext) {
      userContent.push({
        type: "text",
        text: `Zusaetzliche Textauszuege aus den Dateien:\n${sourceContext}`,
      });
    }

    userContent.push(...fileParts);

    const { output: generated }: { output: QuizGenerationResult } = await generateText({
      model: model("gemini-2.5-flash"),
      temperature: 0.3,
      maxOutputTokens: 2_000,
      output: Output.object({
        schema: quizGenerationSchema,
      }),
      system:
        "Du bist ein akademischer Tutor. Erzeuge realistische Pruefungsfragen auf Deutsch und bleibe klar und praezise.",
      messages: [{ role: "user", content: userContent }],
    });

    const normalizedQuestions = generated.questions.slice(0, desiredCount).map((question, index) => ({
      id: `${Date.now()}-${index + 1}`,
      topic: question.topic,
      prompt: question.prompt,
      idealAnswer: question.idealAnswer,
      explanationHint: question.explanationHint,
    }));

    await ctx.runMutation(internal.study.storeGeneratedQuiz, {
      sessionId: args.sessionId,
      sourceSummary: generated.sourceSummary,
      sourceTopics: generated.topics.slice(0, 10),
      quizQuestions: normalizedQuestions,
      incrementRound: false,
    });

    return {
      questionCount: normalizedQuestions.length,
    };
  },
});

export const evaluateAnswer = action({
  args: {
    grantToken: v.string(),
    sessionId: v.id("studySessions"),
    questionId: v.string(),
    userAnswer: v.string(),
    timeSpentSeconds: v.number(),
  },
  handler: async (ctx, args): Promise<AnswerEvaluationResult> => {
    const evaluationContext: { round: number; question: QuestionForEvaluation } = await ctx.runQuery(
      internal.study.getQuestionForEvaluation,
      {
      grantToken: args.grantToken,
      sessionId: args.sessionId,
      questionId: args.questionId,
      },
    );

    const { round, question } = evaluationContext;

    const model = createVertexModel();
    const { output: generated }: { output: AnswerEvaluationResult } = await generateText({
      model: model("gemini-2.5-flash"),
      temperature: 0.1,
      maxOutputTokens: 800,
      output: Output.object({
        schema: answerEvaluationSchema,
      }),
      system:
        "Du bist ein fairer und unterstuetzender Pruefungs-Korrektor. Antworte auf Deutsch und erklaere kurz, was richtig ist oder fehlt.",
      prompt: `Thema: ${question.topic}
Frage: ${question.prompt}
Erwartete Antwort-Richtung: ${question.idealAnswer}
Hinweis bei Bedarf: ${question.explanationHint}

Antwort der lernenden Person:
${args.userAnswer}

Gib eine objektive Bewertung mit einem Score zwischen 0 und 100.`,
    });

    const roundedScore = Math.round(Math.max(0, Math.min(100, generated.score)));

    await ctx.runMutation(internal.study.storeQuizResponse, {
      sessionId: args.sessionId,
      round,
      questionId: question.id,
      topic: question.topic,
      prompt: question.prompt,
      userAnswer: args.userAnswer,
      isCorrect: generated.isCorrect,
      score: roundedScore,
      explanation: generated.explanation,
      idealAnswer: generated.idealAnswer,
      timeSpentSeconds: Math.max(1, Math.round(args.timeSpentSeconds)),
    });

    return {
      isCorrect: generated.isCorrect,
      score: roundedScore,
      explanation: generated.explanation,
      idealAnswer: generated.idealAnswer,
    };
  },
});

export const analyzePerformance = action({
  args: {
    grantToken: v.string(),
    sessionId: v.id("studySessions"),
  },
  handler: async (ctx, args) => {
    const { session, responses } = await ctx.runQuery(internal.study.getAnalysisContext, {
      grantToken: args.grantToken,
      sessionId: args.sessionId,
    });

    if (responses.length === 0) {
      throw new Error("Beantworte mindestens eine Frage, bevor du die Analyse startest.");
    }

    const model = createVertexModel();
    const fallback = buildFallbackAnalysis(responses, session.currentFocusTopic);

    let analysis = fallback;

    try {
      const { output: generated }: { output: AnalysisResult } = await generateText({
        model: model("gemini-2.5-flash"),
        temperature: 0.2,
        maxOutputTokens: 1_500,
        output: Output.object({
          schema: analysisSchema,
        }),
        system:
          "Du bist ein Lerncoach. Analysiere Wissensluecken aus den Antworten und gib konkrete Empfehlungen auf Deutsch.",
        prompt: `Analysiere diese Uebungssitzung und erstelle einen themenbasierten Lernstandsbericht.

Fokus-Thema der Sitzung: ${session.currentFocusTopic ?? "kein spezielles Fokus-Thema"}
Antworten:
${JSON.stringify(responses, null, 2)}

Sei streng, aber konstruktiv.`,
      });

      analysis = {
        overallReadiness: Math.round(generated.overallReadiness),
        strongestTopics: generated.strongestTopics,
        weakestTopics: generated.weakestTopics,
        topics: generated.topics.map((topic) => ({
          topic: topic.topic,
          comfortScore: Math.round(topic.comfortScore),
          rationale: topic.rationale,
          recommendation: topic.recommendation,
        })),
        recommendedNextStep: generated.recommendedNextStep,
      };
    } catch {
      // Keep deterministic fallback analysis when the LLM call fails.
    }

    await ctx.runMutation(internal.study.storeSessionAnalysis, {
      sessionId: args.sessionId,
      analysis,
    });

    return analysis;
  },
});

export const generateTopicDeepDive = action({
  args: {
    grantToken: v.string(),
    sessionId: v.id("studySessions"),
    topic: v.string(),
  },
  handler: async (ctx, args) => {
    const deepDiveContext: { documents: SessionDocumentInput[] } = await ctx.runQuery(
      internal.study.getQuizGenerationContext,
      {
      grantToken: args.grantToken,
      sessionId: args.sessionId,
      },
    );

    const documents = deepDiveContext.documents;

    const readyDocuments = documents.filter(
      (document: SessionDocumentInput) => document.extractionStatus === "ready",
    );
    if (readyDocuments.length === 0) {
      throw new Error("Es ist kein verarbeitetes Material fuer die Vertiefung verfuegbar.");
    }

    const { fileParts, sourceContext } = await buildModelInputFromDocuments(
      ctx,
      readyDocuments.map((document: SessionDocumentInput) => ({
        storageId: document.storageId,
        fileName: document.fileName,
        fileType: document.fileType,
        extractedText: document.extractedText,
      })),
    );

    if (fileParts.length === 0 && !sourceContext) {
      throw new Error("Es konnten keine nutzbaren Inhalte fuer die Vertiefung gelesen werden.");
    }

    const userContent: Array<
      | { type: "text"; text: string }
      | { type: "file"; data: Buffer; mediaType: string; filename: string }
    > = [
      {
        type: "text",
        text: `Erstelle 5 kurze Vertiefungsfragen zu folgendem Thema: ${args.topic}

Nutze nur das bereitgestellte Lernmaterial und formuliere die Fragen prufungsnah.`,
      },
    ];

    if (sourceContext) {
      userContent.push({
        type: "text",
        text: `Zusaetzliche Textauszuege aus den Dateien:\n${sourceContext}`,
      });
    }

    userContent.push(...fileParts);

    const model = createVertexModel();

    const { output: generated }: { output: DeepDiveGenerationResult } = await generateText({
      model: model("gemini-2.5-flash"),
      temperature: 0.25,
      maxOutputTokens: 1_700,
      output: Output.object({
        schema: deepDiveSchema,
      }),
      system: "Du bist ein fokussierter Tutor und erstellst anspruchsvolle, aber faire Vertiefungsfragen auf Deutsch.",
      messages: [{ role: "user", content: userContent }],
    });

    const deepDiveQuestions = generated.questions.slice(0, 5).map((question, index) => ({
      id: `deep-${Date.now()}-${index + 1}`,
      topic: question.topic,
      prompt: question.prompt,
      idealAnswer: question.idealAnswer,
      explanationHint: question.explanationHint,
    }));

    await ctx.runMutation(internal.study.storeGeneratedQuiz, {
      sessionId: args.sessionId,
      sourceSummary: generated.sourceSummary,
      sourceTopics: generated.topics,
      quizQuestions: deepDiveQuestions,
      currentFocusTopic: args.topic,
      incrementRound: true,
    });

    return {
      questionCount: deepDiveQuestions.length,
      topic: args.topic,
    };
  },
});
