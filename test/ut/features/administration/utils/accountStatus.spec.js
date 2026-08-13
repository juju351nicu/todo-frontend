import { describe, expect, it } from "vitest";

import {
  getAccountStatusColor,
  getAccountStatusLabel,
} from "@/features/administration/utils/accountStatus";

describe("Account status display", () => {
  it.each([
    ["ACTIVE", "有効", "success"],
    ["LOCKED", "ロック中", "warning"],
    ["DISABLED", "無効", "default"],
  ])("%sを表示ラベルと色へ変換する", (status, label, color) => {
    expect(getAccountStatusLabel(status)).toBe(label);
    expect(getAccountStatusColor(status)).toBe(color);
  });
});
