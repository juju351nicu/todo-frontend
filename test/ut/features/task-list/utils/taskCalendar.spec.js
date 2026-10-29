import { describe, expect, it } from "vitest";

import { buildTaskCalendarEvents } from "@/features/task-list/utils/taskCalendar";

describe("Taskカレンダーの変換", () => {
  it("Task一覧をFullCalendarイベントへ変換する", () => {
    const events = buildTaskCalendarEvents([
      {
        taskId: 42,
        title: "設計",
        start: "2026-08-08",
        end: "2026-08-31",
        color: "#ff0000",
        url: null,
        display: null,
        description: "説明",
        detail: "詳細",
        doneFlag: false,
        userId: 5,
        remainingDays: 3,
        firstName: null,
        lastName: null,
        priority: 2,
      },
    ]);

    expect(events).toEqual([
      expect.objectContaining({
        id: "42",
        title: "設計",
        start: "2026-08-08",
        end: "2026-08-31",
        color: "#ff0000",
        extendedProps: expect.objectContaining({
          taskId: 42,
          detail: "詳細",
          priority: 2,
        }),
      }),
    ]);
  });
});
