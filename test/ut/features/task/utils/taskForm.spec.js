import { describe, expect, it } from "vitest";

import {
  buildTodoUpsertRequest,
  createTodoDetailForm,
} from "@/features/task/utils/taskForm";

describe("Todo detail form mapper", () => {
  it("Todo詳細のsnake_caseと文字列フラグを画面用へ変換する", () => {
    expect(
      createTodoDetailForm({
        todo_id: 42,
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
      todoId: 42,
      dateFrom: "2026-08-08",
      dateTo: "2026-08-31",
      doneFlag: 1,
      userId: 5,
      priority: 2,
      version: 4,
    });
  });

  it("新規登録ではTodoフォームの初期値を返す", () => {
    expect(createTodoDetailForm()).toMatchObject({
      todoId: 0,
      doneFlag: 0,
      priority: 3,
    });
  });

  it("画面フォームを登録更新Requestへ変換する", () => {
    const form = createTodoDetailForm({
      todo_id: 42,
      date_from: "2026-08-08",
      date_to: "2026-08-31",
      title: "詳細API対応",
      detail: "再読み込みに対応する",
      done_flag: "1",
      user_id: 5,
      priority: 2,
      version: 4,
    });

    expect(buildTodoUpsertRequest(form, 1)).toEqual({
      todo_id: 42,
      date_from: "2026-08-08",
      date_to: "2026-08-31",
      title: "詳細API対応",
      detail: "再読み込みに対応する",
      done_flag: "1",
      role: 1,
      priority: 2,
      version: 4,
      user_id: 5,
    });
  });
});
