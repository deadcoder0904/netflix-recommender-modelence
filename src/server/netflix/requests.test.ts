import { describe, expect, it } from "bun:test";
import { getRequestCounts, recordRequest, resetRequestCounts } from "./requests";

describe("request counters", () => {
  it("tracks and resets counts", () => {
    resetRequestCounts();
    recordRequest("netflix.search");
    recordRequest("netflix.search");
    recordRequest("netflix.filters");

    const snapshot = getRequestCounts(60_000);
    expect(snapshot.counts["netflix.search"]).toBe(2);
    expect(snapshot.counts["netflix.filters"]).toBe(1);

    resetRequestCounts();
    const afterReset = getRequestCounts(60_000);
    expect(afterReset.counts["netflix.search"]).toBeUndefined();
  });
});
