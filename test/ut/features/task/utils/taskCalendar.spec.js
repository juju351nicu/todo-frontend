import { describe, expect, it } from "vitest";

import { buildTodoCalendarEvents } from "@/features/task/utils/taskCalendar";

describe("Todo calendar mapper", () => {
  it("Todo一覧をFullCalendarイベントへ変換する", () => {
    const events = buildTodoCalendarEvents([
      {
        todoId: 42,
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
          todoId: 42,
          detail: "詳細",
          priority: 2,
        }),
      }),
    ]);
  });
});
