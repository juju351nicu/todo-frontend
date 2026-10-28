import { describe, expect, it } from "vitest";

import {
  formatAuthorizationAuditOccurredAt,
  formatRoleNames,
  getAuthorizationAuditActionColor,
  getAuthorizationAuditActionLabel,
  resolveRoleName,
} from "@/features/administration/utils/authorizationAudit";

describe("Authorization audit display", () => {
  it.each([
    ["ROLE_ASSIGNED", "付与", "success"],
    ["ROLE_REVOKED", "取消", "warning"],
  ])("%sを表示ラベルと色へ変換する", (action, label, color) => {
    expect(getAuthorizationAuditActionLabel(action)).toBe(label);
    expect(getAuthorizationAuditActionColor(action)).toBe(color);
  });

  it("ロール集合を表示名の読点区切りへ変換し、空集合はなしにする", () => {
    const roleNames = new Map([
      ["SYSTEM_ADMIN", "システム管理者"],
      ["USER", "一般利用者"],
    ]);

    expect(formatRoleNames([], roleNames)).toBe("なし");
    expect(formatRoleNames(["SYSTEM_ADMIN", "USER"], roleNames)).toBe(
      "システム管理者、一般利用者"
    );
  });

  it("表示名のないロールはコードのまま表示する", () => {
    expect(resolveRoleName("DELETED_ROLE", new Map())).toBe("DELETED_ROLE");
    expect(formatRoleNames(["USER"], new Map())).toBe("USER");
  });

  it("ISO日時を利用端末の日本語日時へ変換する", () => {
    const occurredAt = "2026-08-13T16:23:45Z";
    const expected = new Intl.DateTimeFormat("ja-JP", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).format(new Date(occurredAt));

    expect(formatAuthorizationAuditOccurredAt(occurredAt)).toBe(expected);
  });

  it("不正な日時は監査値を隠さず元文字列を表示する", () => {
    expect(formatAuthorizationAuditOccurredAt("invalid-date")).toBe(
      "invalid-date"
    );
  });
});
