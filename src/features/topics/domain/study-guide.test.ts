import { describe, expect, it } from "vitest";
import { parseStudyGuide } from "./study-guide";

describe("parseStudyGuide", () => {
  it("maps a structured guide and only accepts well-formed reference URLs", () => {
    const guide = parseStudyGuide({
      objective: "Localizar evidências no texto.",
      study_points: ["Identificar quantificadores", " Sustentar com trecho "],
      exam_style: { board: "Cebraspe", description: "O item altera uma condição.", evidence_type: "explicação didática" },
      pitfalls: [{ description: "Generalização indevida" }],
      examples: [{ statement: "Item de exemplo", answer: "Errado", explanation: "Não há suporte textual.", original: true }],
      practice: { first_questions: 15, platform: "Plataforma externa", filters: ["Cebraspe"], video_search: "Busca sugerida", active_recall: "Explique a regra" },
      incidence: { status: "não apurada", measured_percent: null, measured_sample: null },
    }, {
      coverage_note: "A correspondência ainda não foi auditada.",
      official_sources: [{ exam: "Prova oficial", reference: "Anexo", url: "https://example.org/prova" }],
    }, "Nota pessoal preservada.");

    expect(guide).toMatchObject({
      objective: "Localizar evidências no texto.",
      studyPoints: ["Identificar quantificadores", "Sustentar com trecho"],
      examStyle: { board: "Cebraspe", evidenceType: "explicação didática" },
      pitfalls: ["Generalização indevida"],
      examples: [{ answer: "Errado", original: true }],
      incidence: { measuredPercent: null, measuredSample: null },
      officialSources: [{ exam: "Prova oficial", reference: "Anexo", url: "https://example.org/prova" }],
      legacyNotes: "Nota pessoal preservada.",
    });
  });

  it("keeps partial guides readable and returns no guide for a non-object payload", () => {
    expect(parseStudyGuide({ objective: "Objetivo parcial", study_points: "invalid", exam_style: null, examples: [{ answer: "Sem enunciado" }] }, null, null)).toMatchObject({
      objective: "Objetivo parcial",
      studyPoints: [],
      examStyle: null,
      examples: [],
      officialSources: [],
    });
    expect(parseStudyGuide(null, null, null)).toBeNull();
  });
});
