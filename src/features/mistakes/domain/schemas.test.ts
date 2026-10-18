import { describe, expect, it } from "vitest";
import { mistakeEntrySchema } from "./schemas";

const entry = {
  id: null,
  operationKey: "dbfe0109-cb5b-47ab-94e8-9b52e8d3e804",
  subjectId: "f11c9bc3-83e9-4edb-997f-34345fd65c57",
  topicId: null,
  questionBatchId: null,
  reason: "interpretacao",
  thought: "Interpretei o trecho como opinião do autor.",
  correctRule: "A inferência deve ser sustentada pelo texto.",
  nextStep: "Rever o tópico de inferência.",
  externalReference: "QCO-1842",
  status: "needs_review",
};

describe("mistake entry validation", () => {
  it("accepts a qualitative note without requiring a question stem", () => {
    expect(mistakeEntrySchema.parse(entry).reason).toBe("interpretacao");
  });

  it("accepts a public HTTPS reference and rejects unsafe schemes", () => {
    expect(mistakeEntrySchema.safeParse({ ...entry, externalReference: "https://example.com/question/42" }).success).toBe(true);
    expect(mistakeEntrySchema.safeParse({ ...entry, externalReference: "javascript:alert(1)" }).success).toBe(false);
    expect(mistakeEntrySchema.safeParse({ ...entry, externalReference: "https://user:secret@example.com/" }).success).toBe(false);
  });

  it("requires the learning thought and corrected rule", () => {
    expect(mistakeEntrySchema.safeParse({ ...entry, thought: " " }).success).toBe(false);
    expect(mistakeEntrySchema.safeParse({ ...entry, correctRule: "" }).success).toBe(false);
  });
});
