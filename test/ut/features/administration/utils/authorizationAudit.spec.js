import { describe, expect, it } from "vitest";

import {
  formatAuthorizationAuditOccurredAt,
  formatRoleCodes,
  getAuthorizationAuditActionColor,
  getAuthorizationAuditActionLabel,
} from "@/features/administration/utils/authorizationAudit";

describe("Authorization audit display", () => {
  it.each([
    ["ROLE_ASSIGNED", "付与", "success"],
    ["ROLE_REVOKED", "取消", "warning"],
  ])("%sを表示ラベルと色へ変換する", (action, label, color) => {
    expect(getAuthorizationAuditActionLabel(action)).toBe(label);
    expect(getAuthorizationAuditActionColor(action)).toBe(color);
  });

  it("ロール集合を表示文字列へ変換する", () => {
    expect(formatRoleCodes([])).toBe("なし");
    expect(formatRoleCodes(["SYSTEM_ADMIN", "USER"])).toBe(
      "SYSTEM_ADMIN、USER"
    );
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
