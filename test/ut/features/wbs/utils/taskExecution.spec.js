import { describe, expect, it } from "vitest";
import {
  buildExecutionSettingRequest,
  createExecutionSettingForm,
  formatExecutionMode,
  isWithinExecutionSession,
} from "@/features/wbs/utils/taskExecution";

describe("本人が申告する実行設定", () => {
  it.each([
    ["2026-11-22T23:59:59.999999999Z", false],
    ["2026-11-23T00:00:00Z", true],
    ["2026-11-23T00:00:00.000001Z", true],
    ["2026-11-23T00:00:00.000002Z", false],
    ["2026-11-23T00:00:00.001Z", false],
    ["invalid", false],
  ])("計測候補%sは開始以上・停止未満と小数桁を守る: %s", (recordedAt, expected) => {
    expect(
      isWithinExecutionSession(recordedAt, {
        startedAt: "2026-11-23T00:00:00Z",
        stoppedAt: "2026-11-23T00:00:00.000002Z",
      })
    ).toBe(expected);
  });
  it("初期値からmodel・modeを推測せず未選択なら送信しない", () => {
    const form = createExecutionSettingForm();
    expect(form.modelIdentifier).toBe("");
    expect(buildExecutionSettingRequest(form)).toBeNull();
    expect(formatExecutionMode(null)).toBe("設定未記録");
    expect(formatExecutionMode({ assistanceMode: "NONE" })).toBe("AI支援なし");
  });

  it("公開設定だけをtrimし、空欄と関連なしをnullへ変換する", () => {
    expect(
      buildExecutionSettingRequest({
        ...createExecutionSettingForm(),
        timerSessionId: 12,
        assistanceMode: "CODING_AGENT",
        agentName: " Codex ",
        modelIdentifier: " test-model ",
        serviceTier: " ",
        privateValue: "must-not-send",
      })
    ).toEqual({
      timerSessionId: 12,
      progressMeasurementId: null,
      assistanceMode: "CODING_AGENT",
      agentName: "Codex",
      modelIdentifier: "test-model",
      reasoningEffort: null,
      serviceTier: null,
    });
  });

  it("支援なしでは残っているmodel下書きを送らない", () => {
    const request = buildExecutionSettingRequest({
      ...createExecutionSettingForm(),
      timerSessionId: 12,
      assistanceMode: "NONE",
      modelIdentifier: "draft",
      progressMeasurementId: 8,
    });
    expect(request).toMatchObject({ modelIdentifier: null, progressMeasurementId: 8 });
  });

  it.each([
    { timerSessionId: 0 },
    { timerSessionId: 1.5 },
    { progressMeasurementId: -1 },
    { agentName: "a".repeat(65) },
    { modelIdentifier: "a".repeat(129) },
    { reasoningEffort: "a".repeat(33) },
    { serviceTier: "a".repeat(33) },
    { modelIdentifier: "invalid\nmodel" },
    { agentName: "invalid\u0085name" },
  ])("不正なID・上限・制御文字を送信しない: %j", (invalid) => {
    expect(
      buildExecutionSettingRequest({
        ...createExecutionSettingForm(),
        timerSessionId: 12,
        assistanceMode: "CODING_AGENT",
        ...invalid,
      })
    ).toBeNull();
  });
});
