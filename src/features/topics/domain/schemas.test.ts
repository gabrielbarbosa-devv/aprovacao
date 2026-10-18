import { describe, expect, it } from "vitest";
import { createTopicSchema, reorderTopicsSchema, topicFieldsSchema } from "./schemas";

const validFields = {
  title: "  Interpretação   de texto ", status: "nao_iniciado", priority: "media",
  estimatedMinutes: null, sourceUrl: "", notes: "",
};

describe("topic schemas", () => {
  it("normalizes valid topic input and empty optional fields", () => {
    expect(createTopicSchema.parse({ ...validFields, subjectId: "123e4567-e89b-42d3-a456-426614174000" })).toMatchObject({
      title: "Interpretação de texto", sourceUrl: null, notes: null,
    });
  });

  it("accepts normalized null values when the server validates submitted optional fields again", () => {
    expect(createTopicSchema.parse({
      ...validFields,
      sourceUrl: null,
      notes: null,
      subjectId: "123e4567-e89b-42d3-a456-426614174000",
    })).toMatchObject({ sourceUrl: null, notes: null });
  });

  it("rejects invalid or non-web URLs and invalid durations", () => {
    expect(topicFieldsSchema.safeParse({ ...validFields, sourceUrl: "javascript:alert(1)" }).success).toBe(false);
    expect(topicFieldsSchema.safeParse({ ...validFields, sourceUrl: "https://" }).success).toBe(false);
    expect(topicFieldsSchema.safeParse({ ...validFields, estimatedMinutes: 481 }).success).toBe(false);
  });

  it("rejects empty names and duplicate reorder ids", () => {
    expect(topicFieldsSchema.safeParse({ ...validFields, title: " " }).success).toBe(false);
    const id = "123e4567-e89b-42d3-a456-426614174000";
    expect(reorderTopicsSchema.safeParse({ subjectId: id, topicIds: [id, id] }).success).toBe(false);
  });
});
