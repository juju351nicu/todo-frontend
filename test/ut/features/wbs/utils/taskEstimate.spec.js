import { describe, expect, it } from "vitest";

import {
  buildHumanEstimateCreateRequest,
  buildHumanEstimateForm,
  buildTaskEstimateDecisionCreateRequest,
  buildTaskEstimateDecisionForm,
  formatEstimateAssistanceMode,
  formatTaskEstimateDecision,
  formatTaskEstimateRange,
  formatTaskEstimateSource,
  validateHumanEstimateForm,
  validateTaskEstimateDecisionForm,
} from "@/features/wbs/utils/taskEstimate";

describe("Human Estimate入力", () => {
  it("空FormをAI支援なしの単一点入力として初期化する", () => {
    expect(buildHumanEstimateForm()).toEqual({
      assistanceMode: "NONE",
      estimateLowMinutes: null,
      estimateLikelyMinutes: null,
      estimateHighMinutes: null,
    });
  });

  it.each([
    ["単一点", { estimateLowMinutes: null, estimateLikelyMinutes: 360, estimateHighMinutes: null }],
    ["3点", { estimateLowMinutes: 240, estimateLikelyMinutes: 360, estimateHighMinutes: 480 }],
    [
      "同値の3点",
      { estimateLowMinutes: 360, estimateLikelyMinutes: 360, estimateHighMinutes: 360 },
    ],
  ])("%sは入力エラーにならない", (_condition, estimates) => {
    expect(validateHumanEstimateForm({ assistanceMode: "NONE", ...estimates })).toEqual([]);
  });

  it.each([
    [
      "最頻値が未入力",
      { estimateLowMinutes: null, estimateLikelyMinutes: null, estimateHighMinutes: null },
      ["最頻値は1分以上の整数で入力してください。"],
    ],
    [
      "楽観値だけを入力",
      { estimateLowMinutes: 240, estimateLikelyMinutes: 360, estimateHighMinutes: null },
      ["3点見積もりでは楽観値と悲観値を両方入力してください。"],
    ],
    [
      "悲観値だけを入力",
      { estimateLowMinutes: null, estimateLikelyMinutes: 360, estimateHighMinutes: 480 },
      ["3点見積もりでは楽観値と悲観値を両方入力してください。"],
    ],
    [
      "0と小数を入力",
      { estimateLowMinutes: 0, estimateLikelyMinutes: 1.5, estimateHighMinutes: 480 },
      [
        "最頻値は1分以上の整数で入力してください。",
        "楽観値と悲観値は1分以上の整数で入力してください。",
      ],
    ],
    [
      "楽観値が最頻値より大きい",
      { estimateLowMinutes: 361, estimateLikelyMinutes: 360, estimateHighMinutes: 480 },
      ["3点見積もりは楽観値、最頻値、悲観値の順に入力してください。"],
    ],
    [
      "最頻値が悲観値より大きい",
      { estimateLowMinutes: 240, estimateLikelyMinutes: 481, estimateHighMinutes: 480 },
      ["3点見積もりは楽観値、最頻値、悲観値の順に入力してください。"],
    ],
  ])("%sでは理由を返す", (_condition, estimates, expected) => {
    expect(validateHumanEstimateForm({ assistanceMode: "NONE", ...estimates })).toEqual(expected);
  });

  it("検証済みFormへ取得時点Task versionを加えてRequestを作る", () => {
    expect(
      buildHumanEstimateCreateRequest(
        {
          assistanceMode: "CODING_AGENT",
          estimateLowMinutes: 240,
          estimateLikelyMinutes: 360,
          estimateHighMinutes: 480,
        },
        4
      )
    ).toEqual({
      assistanceMode: "CODING_AGENT",
      estimateLowMinutes: 240,
      estimateLikelyMinutes: 360,
      estimateHighMinutes: 480,
      taskVersion: 4,
    });
  });
});

describe("見積もり採否入力", () => {
  const estimate = {
    taskEstimateSnapshotId: 61,
    projectId: 7,
    taskId: 2,
    revision: 1,
    sourceCode: "HUMAN",
    assistanceMode: "NONE",
    estimateLowMinutes: null,
    estimateLikelyMinutes: 420,
    estimateHighMinutes: null,
    sourceTaskVersion: 4,
    requestedByAccountId: 2,
    createdAt: "2026-08-22T01:00:00Z",
  };

  it("最新の未採否snapshotをそのまま採用するFormとして初期化する", () => {
    expect(buildTaskEstimateDecisionForm(61)).toEqual({
      taskEstimateSnapshotId: 61,
      decisionCode: "ADOPTED",
      adjustedPlannedEffortMinutes: null,
    });
  });

  it.each([
    ["そのまま採用", "ADOPTED", null],
    ["調整して採用", "ADJUSTED", 360],
    ["却下", "REJECTED", null],
  ])("%sを有効な採否として検証する", (_condition, decisionCode, adjustedMinutes) => {
    expect(
      validateTaskEstimateDecisionForm(
        {
          taskEstimateSnapshotId: 61,
          decisionCode,
          adjustedPlannedEffortMinutes: adjustedMinutes,
        },
        estimate
      )
    ).toEqual([]);
  });

  it.each([
    [
      "revision未選択",
      { taskEstimateSnapshotId: null, decisionCode: "ADOPTED", adjustedPlannedEffortMinutes: null },
      ["採否を決める見積もりrevisionを選択してください。"],
    ],
    [
      "採用時に調整値を指定",
      { taskEstimateSnapshotId: 61, decisionCode: "ADOPTED", adjustedPlannedEffortMinutes: 360 },
      ["調整後の正式予定工数は「調整して採用」の場合だけ入力してください。"],
    ],
    [
      "調整値が0",
      { taskEstimateSnapshotId: 61, decisionCode: "ADJUSTED", adjustedPlannedEffortMinutes: 0 },
      ["調整後の正式予定工数は1分以上の整数で入力してください。"],
    ],
    [
      "調整値が最頻値と同じ",
      { taskEstimateSnapshotId: 61, decisionCode: "ADJUSTED", adjustedPlannedEffortMinutes: 420 },
      ["最頻値を変更せず採用する場合は「そのまま採用」を選択してください。"],
    ],
  ])("%sでは確定理由を返す", (_condition, form, expected) => {
    expect(validateTaskEstimateDecisionForm(form, estimate)).toEqual(expected);
  });

  it("調整採用だけ調整値を残し取得時点Task version付きRequestを作る", () => {
    expect(
      buildTaskEstimateDecisionCreateRequest(
        {
          taskEstimateSnapshotId: 61,
          decisionCode: "ADJUSTED",
          adjustedPlannedEffortMinutes: 360,
        },
        4
      )
    ).toEqual({
      decisionCode: "ADJUSTED",
      adjustedPlannedEffortMinutes: 360,
      taskVersion: 4,
    });
    expect(
      buildTaskEstimateDecisionCreateRequest(
        {
          taskEstimateSnapshotId: 61,
          decisionCode: "REJECTED",
          adjustedPlannedEffortMinutes: 360,
        },
        4
      )
    ).toEqual({
      decisionCode: "REJECTED",
      adjustedPlannedEffortMinutes: null,
      taskVersion: 4,
    });
  });
});

describe("Task見積もり表示", () => {
  const estimate = {
    taskEstimateSnapshotId: 61,
    projectId: 7,
    taskId: 2,
    revision: 1,
    sourceCode: "HUMAN",
    assistanceMode: "NONE",
    estimateLowMinutes: null,
    estimateLikelyMinutes: 90,
    estimateHighMinutes: null,
    sourceTaskVersion: 4,
    requestedByAccountId: 2,
    createdAt: "2026-08-22T01:00:00Z",
  };

  it("変更不能コードを利用者向け名称へ変換する", () => {
    expect(formatTaskEstimateSource("HUMAN")).toBe("Human Estimate");
    expect(formatTaskEstimateSource("AI")).toBe("AI Estimate");
    expect(formatEstimateAssistanceMode("CODING_AGENT")).toBe("Coding Agent");
    expect(formatTaskEstimateDecision("ADJUSTED")).toBe("調整して採用");
  });

  it("単一点と3点見積もりを分・時間表記へ変換する", () => {
    expect(formatTaskEstimateRange(estimate)).toBe("1時間30分");
    expect(
      formatTaskEstimateRange({
        ...estimate,
        estimateLowMinutes: 60,
        estimateHighMinutes: 120,
      })
    ).toBe("1時間 / 1時間30分 / 2時間");
  });
});
