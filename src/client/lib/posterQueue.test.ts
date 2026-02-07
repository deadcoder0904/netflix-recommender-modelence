import { describe, expect, it } from "bun:test";
import { createLimiter } from "./posterQueue";

describe("posterQueue limiter", () => {
  it("respects concurrency limits", async () => {
    const limiter = createLimiter(2, 0);
    let active = 0;
    let maxActive = 0;

    const tasks = Array.from({ length: 6 }, (_, i) =>
      limiter.enqueue(async () => {
        active += 1;
        maxActive = Math.max(maxActive, active);
        await new Promise((resolve) => setTimeout(resolve, 10));
        active -= 1;
        return i;
      }),
    );

    const results = await Promise.all(tasks);
    expect(results.length).toBe(6);
    expect(maxActive).toBeLessThanOrEqual(2);
  });
});
