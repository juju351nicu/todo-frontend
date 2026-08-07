import { describe, expect, it } from "vitest";

import Util from "@/utils/util.js";

describe("Util", () => {
  it.each([null, undefined, "", []])("空の値を判定できる: %s", (value) => {
    expect(Util.isEmpty(value)).toBe(true);
  });

  it.each(["value", [1], 0, false])(
    "値がある場合は空ではない: %s",
    (value) => {
      expect(Util.isEmpty(value)).toBe(false);
    }
  );

  it("文字列中の空白を除去できる", () => {
    expect(Util.trimSpace(" a b\tc\n")).toBe("abc");
  });

  it("全角英数字を半角へ変換できる", () => {
    expect(Util.toHalfWidth("ＡｂＣ１２３-あ")).toBe("AbC123-あ");
  });

  it("配列の重複を除去できる", () => {
    expect(Util.uniqArrayBySet([1, 2, 1, 3, 2])).toEqual([1, 2, 3]);
  });
});
