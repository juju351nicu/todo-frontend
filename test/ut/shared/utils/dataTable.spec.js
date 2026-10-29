import { describe, expect, it } from "vitest";

import {
  formatPageRange,
  fromRowSelection,
  resolvePageSize,
  toRowSelection,
} from "@/shared/utils/dataTable";

describe("dataTable utils", () => {
  it("全件表示では全件数をページ件数にする", () => {
    expect(resolvePageSize(-1, 12)).toBe(12);
  });

  it("全件表示で0件でもページ件数を1にする", () => {
    expect(resolvePageSize(-1, 0)).toBe(1);
  });

  it("通常の表示件数はそのまま使う", () => {
    expect(resolvePageSize(5, 12)).toBe(5);
  });

  it("最終ページの終了位置を全件数で打ち切る", () => {
    expect(formatPageRange(2, 5, 12)).toBe("11〜12件 / 全12件");
  });

  it("先頭ページの範囲を表示する", () => {
    expect(formatPageRange(0, 5, 3)).toBe("1〜3件 / 全3件");
  });

  it("0件では範囲を出さず0件とだけ表示する", () => {
    expect(formatPageRange(0, 5, 0)).toBe("0件");
  });

  it("行IDの配列と行選択stateを相互変換し、数値IDの型を保つ", () => {
    const selection = toRowSelection([1, 3]);

    expect(selection).toEqual({ 1: true, 3: true });
    expect(fromRowSelection(selection, [1, 2, 3])).toEqual([1, 3]);
  });

  it("falseの選択stateは選択済みとして扱わない", () => {
    expect(fromRowSelection({ 1: false, 2: true }, [1, 2])).toEqual([2]);
  });
});
