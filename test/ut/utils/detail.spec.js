import { describe, expect, it } from "vitest";

import {
  createMemberDetailForm,
  createTodoDetailForm,
} from "@/utils/detail.js";

describe("Detail form mapper", () => {
  it("会員詳細をパスワードなしの編集フォームへ変換する", () => {
    expect(
      createMemberDetailForm({
        memberId: 7,
        lastName: "山田",
        firstName: "太郎",
        loginId: "yamada",
        email: "yamada@example.com",
        role: 1,
        version: 3,
        password: "APIに混入しても利用しない",
      })
    ).toEqual({
      memberId: 7,
      lastName: "山田",
      firstName: "太郎",
      loginId: "yamada",
      password: "",
      email: "yamada@example.com",
      role: 1,
      version: 3,
    });
  });

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

  it("新規登録では各フォームの初期値を返す", () => {
    expect(createMemberDetailForm()).toMatchObject({ memberId: 0, role: 2 });
    expect(createTodoDetailForm()).toMatchObject({
      todoId: 0,
      doneFlag: 0,
      priority: 3,
    });
  });
});
