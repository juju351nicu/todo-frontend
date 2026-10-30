import { describe, expect, it } from "vitest";

import {
  buildHumanEstimateCreateRequest,
  buildHumanEstimateForm,
  formatEstimateAssistanceMode,
  formatTaskEstimateRange,
  formatTaskEstimateSource,
  validateHumanEstimateForm,
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
