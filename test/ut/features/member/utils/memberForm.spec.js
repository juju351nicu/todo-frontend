import { describe, expect, it } from "vitest";

import {
  buildMemberConfirmItems,
  buildMemberUpsertRequest,
  createMemberDetailForm,
} from "@/features/member/utils/memberForm";

describe("Member form mapper", () => {
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

  it("新規登録フォームの初期値を返す", () => {
    expect(createMemberDetailForm()).toMatchObject({ memberId: 0, role: 2 });
  });

  it("編集フォームを登録更新Requestへ変換する", () => {
    const form = {
      memberId: 7,
      lastName: "山田",
      firstName: "太郎",
      loginId: "yamada",
      password: "new-password",
      email: "yamada@example.com",
      role: 2,
      version: 3,
    };

    expect(buildMemberUpsertRequest(form)).toEqual(form);
  });
});

describe("buildMemberConfirmItems", () => {
  it("パスワードは値を出さず、権限は表示名にする", () => {
    const items = buildMemberConfirmItems({
      memberId: 0,
      lastName: "山田",
      firstName: "太郎",
      loginId: "yamada",
      password: "secret",
      email: "yamada@example.com",
      role: 1,
      version: 0,
    });

    expect(items).toEqual([
      { label: "氏名", value: "山田 太郎" },
      { label: "ログインID", value: "yamada" },
      { label: "パスワード", value: "入力済み" },
      { label: "Email アドレス", value: "yamada@example.com" },
      { label: "権限", value: "閲覧管理者" },
    ]);
  });
});
