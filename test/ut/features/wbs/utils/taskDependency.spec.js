import { describe, expect, it } from "vitest";

import {
  buildDependencyRows,
  canChangeDependencyEndpoint,
  buildDependencyTaskLabel,
  buildDependencyTaskOptions,
  buildTaskDependencyCreateRequest,
} from "@/features/wbs/utils/taskDependency";

/** 表示名の組立てに必要な項目だけを持つWBS Task。 */
const buildTask = (taskId, wbsCode, title) => ({ taskId, wbsCode, title });

const existingDependencies = [
  {
    dependencyId: 31,
    predecessorTaskId: 1,
    successorTaskId: 2,
    dependencyType: "FINISH_TO_START",
    lagMinutes: 0,
    version: 3,
  },
];

describe("Task依存関係の表示名", () => {
  it.each([
    ["1.1", "実装", "1.1 実装"],
    [null, "実装", "実装"],
    ["  ", "実装", "実装"],
  ])("WBSコード%sのTask名を%sとして表示する", (wbsCode, title, expected) => {
    expect(buildDependencyTaskLabel(buildTask(2, wbsCode, title))).toBe(expected);
  });

  it("候補は渡されたTaskの並びを保ってTask IDを値にする", () => {
    expect(
      buildDependencyTaskOptions([buildTask(3, "1.2", "完了判定"), buildTask(1, null, "Phase 1")])
    ).toEqual([
      { title: "1.2 完了判定", value: 3 },
      { title: "Phase 1", value: 1 },
    ]);
  });

  it("表示対象外の端点Taskも行を消さずTask IDで示す", () => {
    const rows = buildDependencyRows(
      existingDependencies,
      [{ title: "1 Phase 1", value: 1 }],
      () => true
    );

    expect(rows).toEqual([
      {
        ...existingDependencies[0],
        predecessorLabel: "1 Phase 1",
        successorLabel: "Task ID: 2（表示対象外）",
        canDelete: true,
      },
    ]);
  });

  it("先行・後続の片方でも変更できなければ削除不可の行にする", () => {
    const rows = buildDependencyRows(existingDependencies, [], (taskId) => taskId !== 2);

    expect(rows[0].canDelete).toBe(false);
  });
});

describe("依存関係の端点として使えるTask", () => {
  it.each([
    ["Project管理権限があれば担当者に関係なく使える", { assigneeAccountId: 9 }, 2, true, true],
    ["管理権限がなくても本人担当なら使える", { assigneeAccountId: 2 }, 2, false, true],
    ["管理権限がなく他人担当なら使えない", { assigneeAccountId: 9 }, 2, false, false],
    ["WBSに表示していないTaskは管理権限がなければ使えない", undefined, 2, false, false],
    ["ログイン利用者のIDが未取得なら使えない", { assigneeAccountId: 2 }, null, false, false],
  ])("%s", (_name, task, currentAccountId, canManageAnyTask, expected) => {
    expect(canChangeDependencyEndpoint(task, currentAccountId, canManageAnyTask)).toBe(expected);
  });
});

describe("Task依存関係追加Request", () => {
  const availableTaskIds = new Set([1, 2, 3]);

  it("入力が正しければFinish-to-StartのRequestへ変換する", () => {
    expect(
      buildTaskDependencyCreateRequest(
        { predecessorTaskId: 2, successorTaskId: 3, lagMinutes: 30 },
        availableTaskIds,
        existingDependencies
      )
    ).toEqual({
      request: {
        predecessorTaskId: 2,
        successorTaskId: 3,
        dependencyType: "FINISH_TO_START",
        lagMinutes: 30,
      },
      messages: [],
    });
  });

  it("登録済みと逆向きの依存関係は重複として扱わない", () => {
    const result = buildTaskDependencyCreateRequest(
      { predecessorTaskId: 2, successorTaskId: 1, lagMinutes: 0 },
      availableTaskIds,
      existingDependencies
    );

    expect(result.messages).toEqual([]);
    expect(result.request?.predecessorTaskId).toBe(2);
  });

  it.each([null, 0, -1, 1.5, 9])(
    "先行Task ID %s は選択不正として送信しない",
    (predecessorTaskId) => {
      expect(
        buildTaskDependencyCreateRequest(
          { predecessorTaskId, successorTaskId: 3, lagMinutes: 0 },
          availableTaskIds,
          []
        )
      ).toEqual({ request: null, messages: ["先行Taskを選択してください。"] });
    }
  );

  it.each([null, -1, 0.5])("待ち時間 %s は0以上の整数でないため送信しない", (lagMinutes) => {
    expect(
      buildTaskDependencyCreateRequest(
        { predecessorTaskId: 2, successorTaskId: 3, lagMinutes },
        availableTaskIds,
        []
      )
    ).toEqual({
      request: null,
      messages: ["待ち時間は0以上の整数で入力してください。"],
    });
  });

  it("待ち時間0分は境界値として送信できる", () => {
    expect(
      buildTaskDependencyCreateRequest(
        { predecessorTaskId: 2, successorTaskId: 3, lagMinutes: 0 },
        availableTaskIds,
        []
      ).request?.lagMinutes
    ).toBe(0);
  });

  it("同じTask・重複方向・未選択の理由をすべて表示順に返す", () => {
    expect(
      buildTaskDependencyCreateRequest(
        { predecessorTaskId: 1, successorTaskId: 1, lagMinutes: -1 },
        availableTaskIds,
        [{ ...existingDependencies[0], successorTaskId: 1 }]
      ).messages
    ).toEqual([
      "先行Taskと後続Taskには別のTaskを選択してください。",
      "待ち時間は0以上の整数で入力してください。",
      "同じ向きのTask依存関係はすでに登録されています。",
    ]);
    expect(
      buildTaskDependencyCreateRequest(
        { predecessorTaskId: null, successorTaskId: null, lagMinutes: 0 },
        availableTaskIds,
        []
      ).messages
    ).toEqual(["先行Taskを選択してください。", "後続Taskを選択してください。"]);
  });
});
