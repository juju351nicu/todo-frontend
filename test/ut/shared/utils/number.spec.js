import { describe, expect, it } from "vitest";

import { toNumberList } from "@/shared/utils/number";

describe("toNumberList", () => {
  it("文字列と数値の配列を数値配列へ変換する", () => {
    expect(toNumberList(["0", 1, "2"])).toEqual([0, 1, 2]);
  });
});
