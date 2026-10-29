import { describe, expect, it } from "vitest";

import { createLatestRequestTracker } from "@/shared/utils/latestRequest";

describe("createLatestRequestTracker", () => {
  it("後から始めた読込があると、先に始めた読込は最新でなくなる", () => {
    const tracker = createLatestRequestTracker();

    const isFirstRequestLatest = tracker.begin();
    expect(isFirstRequestLatest()).toBe(true);

    const isSecondRequestLatest = tracker.begin();
    expect(isFirstRequestLatest()).toBe(false);
    expect(isSecondRequestLatest()).toBe(true);
  });

  it("別々に作った判定どうしは影響しない", () => {
    const taskTracker = createLatestRequestTracker();
    const commentTracker = createLatestRequestTracker();

    const isTaskRequestLatest = taskTracker.begin();
    commentTracker.begin();

    expect(isTaskRequestLatest()).toBe(true);
  });
});
