import { describe, expect, it } from "vitest";

import {
  buildAccountConfirmItems,
  buildAccountRegisterRequest,
  buildAccountUpdateRequest,
  createAccountDetailForm,
  resolveAccountRoleLabel,
} from "@/features/account/utils/accountForm";

const FORM = {
  accountId: 7,
  lastName: "山田",
  firstName: "太郎",
  loginId: "yamada",
  password: "new-password",
  email: "yamada@example.com",
  version: 3,
  roleNames: ["閲覧管理者"],
};

describe("Account form mapper", () => {
  it("アカウント詳細を、姓・名を入れ替えずパスワードなしの編集フォームへ変換する", () => {
    expect(
      createAccountDetailForm({
        accountId: 7,
        lastName: "山田",
        firstName: "太郎",
        loginId: "yamada",
        email: "yamada@example.com",
        version: 3,
        roleNames: ["閲覧管理者"],
        password: "APIに混入しても利用しない",
      })
    ).toEqual({ ...FORM, password: "" });
  });

  it("新規登録フォームの初期値を返し、ログインIDがnull（GitHubだけのアカウント）なら空文字にする", () => {
    expect(createAccountDetailForm()).toMatchObject({ accountId: 0, version: 0, roleNames: [] });
    expect(createAccountDetailForm({ accountId: 8, loginId: null }).loginId).toBe("");
  });

  it("編集フォームを、ロールを含まない登録・更新Requestへ変換する", () => {
    expect(buildAccountRegisterRequest(FORM)).toEqual({
      lastName: "山田",
      firstName: "太郎",
      loginId: "yamada",
      password: "new-password",
      email: "yamada@example.com",
    });
    expect(buildAccountUpdateRequest(FORM)).toEqual({
      lastName: "山田",
      firstName: "太郎",
      loginId: "yamada",
      password: "new-password",
      email: "yamada@example.com",
      version: 3,
    });
  });

  it("権限の表示は、新規登録ならユーザ、既存ならロールの表示名を並べる", () => {
    expect(resolveAccountRoleLabel({ ...FORM, accountId: 0, roleNames: [] })).toBe("ユーザ");
    expect(resolveAccountRoleLabel({ ...FORM, roleNames: ["システム管理者", "勤怠管理者"] })).toBe(
      "システム管理者、勤怠管理者"
    );
  });
});

describe("buildAccountConfirmItems", () => {
  it("氏名は姓・名の順に並べ、パスワードは値を出さず、権限は表示名にする", () => {
    expect(buildAccountConfirmItems({ ...FORM, password: "secret" })).toEqual([
      { label: "氏名", value: "山田 太郎" },
      { label: "ログインID", value: "yamada" },
      { label: "パスワード", value: "入力済み" },
      { label: "Email アドレス", value: "yamada@example.com" },
      { label: "権限", value: "閲覧管理者" },
    ]);
  });
});
