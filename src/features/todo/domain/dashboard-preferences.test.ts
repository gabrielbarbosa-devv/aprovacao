import { describe, expect, it } from "vitest";
import { dashboardPreferencesKey, parseExpandedDashboardSections, serializeExpandedDashboardSections } from "./dashboard-preferences";

describe("todo dashboard preferences", () => {
  it("namespaces presentation preferences by user and module", () => {
    expect(dashboardPreferencesKey("user-1")).toBe("todo:overview:expanded:v1:user-1");
    expect(dashboardPreferencesKey("user-2")).not.toBe(dashboardPreferencesKey("user-1"));
  });

  it("round trips expanded sections without duplicates", () => {
    const encoded = serializeExpandedDashboardSections(["overview:priorities", "list:abc", "list:abc"]);
    expect(parseExpandedDashboardSections(encoded)).toEqual(["overview:priorities", "list:abc"]);
  });

  it("safely ignores corrupt or unexpected storage values", () => {
    expect(parseExpandedDashboardSections("not-json")).toEqual([]);
    expect(parseExpandedDashboardSections('{"section":"open"}')).toEqual([]);
    expect(parseExpandedDashboardSections('["valid", 3, null]')).toEqual(["valid"]);
  });
});
