import { describe, expect, it } from "vitest";
import { getSafeAuthReturnTo } from "./return-to";

describe("getSafeAuthReturnTo", () => {
  it("preserves only the expected local OAuth consent continuation", () => {
    expect(getSafeAuthReturnTo("/oauth/consent?authorization_id=abc-123_X")).toBe("/oauth/consent?authorization_id=abc-123_X");
  });

  it.each([
    "https://example.com/steal-session",
    "//example.com",
    "/settings",
    "/oauth/consent?authorization_id=contains%2Fslash",
    "/oauth/consent?authorization_id=" + "a".repeat(201),
    undefined,
  ])("rejects unsafe return target %s", (value) => {
    expect(getSafeAuthReturnTo(value)).toBe("/");
  });
});
