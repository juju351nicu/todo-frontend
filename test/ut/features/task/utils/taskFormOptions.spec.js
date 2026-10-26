import { describe, expect, it } from "vitest";

import {
  buildTaskStatusCodeOptions,
  buildTaskStatusIdOptions,
  TASK_PRIORITY_OPTIONS,
} from "@/features/task/utils/taskFormOptions";

const statuses = [
  { taskStatusId: 1, statusCode: "TODO", name: "Todo", completed: false },
  { taskStatusId: 2, statusCode: "DONE", name: "完了", completed: true },
];

describe("taskFormOptions", () => {
  it("優先度は1=低、3=高の順に並べる", () => {
    expect(TASK_PRIORITY_OPTIONS.map((option) => option.value)).toEqual([1, 2, 3]);
    expect(TASK_PRIORITY_OPTIONS[0].title).toBe("低");
  });

  it("完了列を除外する指定のときだけ完了列を除く", () => {
    expect(buildTaskStatusIdOptions(statuses).map((option) => option.value)).toEqual([1, 2]);
    expect(buildTaskStatusIdOptions(statuses, true)).toEqual([{ title: "Todo", value: 1 }]);
  });

  it("status code選択肢は名前とcodeを併記する", () => {
    expect(buildTaskStatusCodeOptions(statuses)[1]).toEqual({ title: "完了（DONE）", value: "DONE" });
  });
});
