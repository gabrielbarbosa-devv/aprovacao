import { describe, expect, it } from "vitest";
import { buildReplanPreview, recommendReinforcement, type ReplanBlock } from "./recommendations";

const recommendations = recommendReinforcement([
  { topicId: "a", subject: "Português", topic: "Interpretação", questions: 20, correct: 5 },
  { topicId: "b", subject: "Direito", topic: "Penal", questions: 20, correct: 18 },
  { topicId: "c", subject: "Lógica", topic: "Proposições", questions: 1, correct: 0 },
], new Set());

describe("recommendReinforcement", () => {
  it("uses weighted accuracy, the minimum sample and a heuristic threshold", () => {
    expect(recommendations.map(({ topicId, accuracy, signal }) => [topicId, accuracy, signal])).toEqual([
      ["a", 25, "high"], ["c", 0, "insufficient"], ["b", 90, "monitor"],
    ]);
  });

  it("keeps qualitative notebook flags distinct from question counts", () => {
    const [result] = recommendReinforcement([], new Set(["flagged"]));
    expect(result).toBeUndefined();
    const flaggedOnly = recommendReinforcement([{ topicId: "flagged", topic: "Regra", subject: "Direito", questions: 0, correct: 0 }], new Set(["flagged"]))[0];
    expect(flaggedOnly).toMatchObject({ flaggedForReview: true, questions: 0, accuracy: null, sampleSufficient: false });
  });
});

const block = (id: string, topicId: string, date: string, minutes = 120, startTime: string | null = null): ReplanBlock => ({
  id, topicId, subject: "Matéria", topic: topicId, date, minutes, startTime,
  status: "planejado", pinned: false, updatedAt: "2026-10-17T10:00:00Z", protectedByExam: false,
});

describe("buildReplanPreview", () => {
  it("shows a topic substitution and relocates the displaced block without increasing capacity", () => {
    const selected = recommendations.filter((entry) => entry.signal === "high");
    const blocks = [block("target", "b", "2026-10-18"), block("displaced", "b", "2026-10-18")];
    const result = buildReplanPreview({ blocks, selected, displaceableTopicIds: new Set(["b"]), today: "2026-10-17", dailyGoalMinutes: 240 });
    expect(result).toHaveLength(2);
    expect(result.find(({ blockId }) => blockId === "target")?.after.topicId).toBe("a");
    expect(result.find(({ blockId }) => blockId === "displaced")?.after.date).toBe("2026-10-19");
  });

  it("does not move pinned or completed study blocks or create capacity above the goal", () => {
    const selected = recommendations.filter((entry) => entry.signal === "high");
    const blocks = [
      { ...block("target", "b", "2026-10-18"), pinned: true },
      { ...block("complete", "b", "2026-10-18"), status: "concluido" as const },
    ];
    expect(buildReplanPreview({ blocks, selected, displaceableTopicIds: new Set(["b"]), today: "2026-10-17", dailyGoalMinutes: 240 })).toEqual([]);
  });
});
