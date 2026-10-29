import { describe, expect, it } from "vitest";

import { validateTaskSnapshot } from "@/features/task/utils/taskSnapshotForm";

const validSnapshot = (overrides = {}) => ({
  title: "週次レポート",
  detail: "前週の実績をまとめる",
  plannedEffortMinutes: 60,
  dueOffsetDays: 2,
  checklistContents: ["集計", "送付"],
  ...overrides,
});

describe("validateTaskSnapshot", () => {
  it("Backendの入力制約を満たすsnapshotは空文字を返す", () => {
    expect(validateTaskSnapshot(validSnapshot())).toBe("");
    expect(
      validateTaskSnapshot(
        validSnapshot({
          title: "あ".repeat(45),
          detail: "い".repeat(1000),
          plannedEffortMinutes: 0,
          dueOffsetDays: 365,
          checklistContents: Array.from({ length: 50 }, () => "う".repeat(255)),
        })
      )
    ).toBe("");
  });

  it.each([
    ["件名が空白だけ", { title: "   " }, "Taskタイトルを1〜45文字で入力してください。"],
    ["件名が46文字", { title: "あ".repeat(46) }, "Taskタイトルを1〜45文字で入力してください。"],
    ["詳細が1001文字", { detail: "い".repeat(1001) }, "Task詳細を1〜1000文字で入力してください。"],
    ["期限オフセットが366日", { dueOffsetDays: 366 }, "期限オフセットを0〜365日で入力してください。"],
    ["期限オフセットが負", { dueOffsetDays: -1 }, "期限オフセットを0〜365日で入力してください。"],
    ["予定工数が小数", { plannedEffortMinutes: 1.5 }, "予定工数を0分以上の整数で入力してください。"],
    ["チェック項目が51件", { checklistContents: Array.from({ length: 51 }, () => "a") }, "チェック項目は1〜255文字、最大50件で入力してください。"],
    ["チェック項目が空白だけ", { checklistContents: [" "] }, "チェック項目は1〜255文字、最大50件で入力してください。"],
  ])("%sなら、その項目の文言を返す", (_label, overrides, expected) => {
    expect(validateTaskSnapshot(validSnapshot(overrides))).toBe(expected);
  });

  it("複数の項目が誤っていれば、件名 → 詳細 → 期限オフセット → 予定工数 → チェック項目の順で最初の1つを返す", () => {
    expect(
      validateTaskSnapshot(validSnapshot({ dueOffsetDays: 999, plannedEffortMinutes: -1 }))
    ).toBe("期限オフセットを0〜365日で入力してください。");
  });
});
