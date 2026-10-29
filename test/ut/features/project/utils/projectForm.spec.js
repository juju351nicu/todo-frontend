import { describe, expect, it } from "vitest";

import { validateProjectKey } from "@/features/project/utils/projectForm";

describe("validateProjectKey", () => {
  it.each(["SALES", "SALES-2026", "A1-B2-C3", "X".repeat(30)])("%sは正しいキー", (projectKey) => {
    expect(validateProjectKey(projectKey)).toBe("");
  });

  it.each(["", "sales", "-SALES", "SALES-", "SALES--2026", "SALES_2026", "営業"])(
    "「%s」は形式の誤り",
    (projectKey) => {
      expect(validateProjectKey(projectKey)).toBe(
        "Projectキーは大文字英数字をハイフンで区切って入力してください（例：SALES-2026）。"
      );
    }
  );

  it("31文字は、形式より先に長さの誤りを返す", () => {
    expect(validateProjectKey("x".repeat(31))).toBe("Projectキーは30文字以内で入力してください。");
  });
});
