// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import TaskExecutionComparisonDialog from "@/features/wbs/components/TaskExecutionComparisonDialog.vue";
import { mountWithUi } from "../../../support/mountWithUi";

const props = () => ({
  open: true,
  task: { taskId: 2, title: "移行" },
  dateFrom: "2026-11-01",
  dateTo: "2026-11-23",
  canRecord: true,
  isLoading: false,
  isSaving: false,
  errorMessages: [],
  successMessage: "",
  comparison: {
    groups: [
      {
        settings: null,
        schemaId: null,
        sessionCount: 1,
        activeDays: 2,
        elapsedSeconds: 120,
        creditedMinutes: 2,
        measurementCount: 0,
        progressDeltaPoints: null,
      },
      {
        settings: { assistanceMode: "NONE" },
        schemaId: "SCHEMA_A",
        sessionCount: 1,
        activeDays: 1,
        elapsedSeconds: 60,
        creditedMinutes: 1,
        measurementCount: 1,
        progressDeltaPoints: 0,
      },
    ],
    days: [
      {
        workDate: "2026-11-23",
        actualEffortMinutes: 1,
        timerCreditedMinutes: 3,
        adjustmentMinutes: -2,
      },
    ],
    sessions: [
      {
        timerSessionId: 12,
        settings: null,
        startedAt: "2026-11-23T01:00:00Z",
        stoppedAt: "2026-11-23T02:00:00.001Z",
      },
    ],
    measurements: [
      {
        measurementId: 8,
        businessDate: "2026-11-23",
        progressPercent: 49.99,
        progressDeltaPoints: -0.01,
        recordedAt: "2026-11-23T02:00:00Z",
        timerSessionId: null,
        schemaId: "SCHEMA_A",
      },
    ],
  },
});

describe("本人の設定別実績Dialog", () => {
  let wrapper;
  afterEach(() => wrapper?.unmount());
  const mountDialog = (overrides = {}) =>
    mountWithUi(TaskExecutionComparisonDialog, {
      props: { ...props(), ...overrides },
      global: {
        stubs: { Modal: { template: "<div><slot name='body'/><slot name='footer'/></div>" } },
      },
    });
  it("未記録と支援なし・未計測と0pt・負の実績差と進捗補正を区別する", () => {
    wrapper = mountDialog();
    for (const text of [
      "設定未記録",
      "AI支援なし",
      "未計測 / 0件",
      "0.00 pt / 1件",
      "-2分",
      "-0.01 pt",
      "SCHEMA_A",
    ])
      expect(wrapper.text()).toContain(text);
  });
  it("参照のみでは申告formを出さず、期間更新だけをemitする", async () => {
    wrapper = mountDialog({ canRecord: false });
    expect(wrapper.findAll("form")).toHaveLength(1);
    await wrapper.find("form").trigger("submit");
    expect(wrapper.emitted("load")).toHaveLength(1);
    expect(wrapper.emitted("save")).toBeUndefined();
  });
  it("未選択のままsubmitしても保存せず、保存中のcloseも抑止する", async () => {
    wrapper = mountDialog();
    await wrapper.findAll("form")[1].trigger("submit");
    expect(wrapper.emitted("save")).toBeUndefined();
    await wrapper.setProps({ isSaving: true });
    const closeButton = wrapper.findAll("button").find((button) => button.text() === "閉じる");
    expect(closeButton.attributes("disabled")).toBeDefined();
    expect(wrapper.emitted("close")).toBeUndefined();
  });
  it("停止Timerとmodeを選び、秒の桁が異なる区間内計測も候補にして下書きを送る", async () => {
    wrapper = mountDialog();
    const selects = wrapper.findAllComponents({ name: "Select" });
    expect(selects).toHaveLength(3);
    selects[0].vm.$emit("update:modelValue", 12);
    await wrapper.vm.$nextTick();
    expect(selects[2].props("items").map((item) => item.value)).toEqual([0, 8]);
    selects[1].vm.$emit("update:modelValue", "CODING_AGENT");
    await wrapper.get('input[placeholder="例：Codex"]').setValue("Codex");
    await wrapper.findAll("form")[1].trigger("submit");
    expect(wrapper.emitted("save")).toEqual([
      [
        {
          timerSessionId: 12,
          progressMeasurementId: 0,
          assistanceMode: "CODING_AGENT",
          agentName: "Codex",
          modelIdentifier: "",
          reasoningEffort: "",
          serviceTier: "",
        },
      ],
    ]);
  });
  it("空の履歴も設定や進捗を補完せず案内する", () => {
    wrapper = mountDialog({ comparison: { groups: [], days: [], sessions: [], measurements: [] } });
    expect(wrapper.text()).toContain("停止済みTimer配賦はありません");
    expect(wrapper.text()).toContain("本人の進捗計測はありません");
    expect(wrapper.findAll("form")).toHaveLength(1);
  });
});
