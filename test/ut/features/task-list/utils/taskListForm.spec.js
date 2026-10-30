import { describe, expect, it } from "vitest";

import {
  buildTaskListConfirmItems,
  buildTaskListUpsertRequest,
  createTaskListDetailForm,
} from "@/features/task-list/utils/taskListForm";

describe("Task一覧の詳細フォームの変換", () => {
  it("Task詳細のsnake_caseと文字列フラグを画面用へ変換する", () => {
    expect(
      createTaskListDetailForm({
        task_id: 42,
        date_from: "2026-08-08",
        date_to: "2026-08-31",
        title: "詳細API対応",
        detail: "再読み込みに対応する",
        done_flag: "1",
        user_id: 5,
        priority: 2,
        version: 4,
      })
    ).toMatchObject({
      taskId: 42,
      dateFrom: "2026-08-08",
      dateTo: "2026-08-31",
      doneFlag: 1,
      userId: 5,
      priority: 2,
      version: 4,
    });
  });

  it("新規登録ではTaskフォームの初期値を返す", () => {
    expect(createTaskListDetailForm()).toMatchObject({
      taskId: 0,
      userId: 0,
      doneFlag: 0,
      priority: 3,
    });
  });

  it("画面フォームを登録更新Requestへ変換する", () => {
    const form = createTaskListDetailForm({
      task_id: 42,
      date_from: "2026-08-08",
      date_to: "2026-08-31",
      title: "詳細API対応",
      detail: "再読み込みに対応する",
      done_flag: "1",
      user_id: 5,
      priority: 2,
      version: 4,
    });

    expect(buildTaskListUpsertRequest(form)).toEqual({
      task_id: 42,
      date_from: "2026-08-08",
      date_to: "2026-08-31",
      title: "詳細API対応",
      detail: "再読み込みに対応する",
      done_flag: "1",
      priority: 2,
      version: 4,
      user_id: 5,
    });
  });
});

describe("buildTaskListConfirmItems", () => {
  it("確認Dialogの項目を詳細画面と同じ見出しで、重要度・完了フラグは表示用の文言にして並べる", () => {
    const form = createTaskListDetailForm({
      task_id: 3,
      date_from: "2026-10-27",
      date_to: "2026-10-30",
      title: "買い物",
      detail: "牛乳とパン",
      done_flag: "1",
      priority: 1,
      version: 2,
      user_id: 5,
    });

    expect(buildTaskListConfirmItems(form)).toEqual([
      { label: "タイトル", value: "買い物" },
      { label: "着手日", value: "2026-10-27" },
      { label: "期限日", value: "2026-10-30" },
      { label: "重要度", value: "低" },
      { label: "完了フラグ", value: "完了" },
      { label: "詳細", value: "牛乳とパン" },
    ]);
  });

  it("未完了は「未完了」と表示する", () => {
    const items = buildTaskListConfirmItems(
      createTaskListDetailForm({ done_flag: "0", priority: 3 })
    );

    expect(items.find((item) => item.label === "完了フラグ")?.value).toBe("未完了");
    expect(items.find((item) => item.label === "重要度")?.value).toBe("高");
  });
});
