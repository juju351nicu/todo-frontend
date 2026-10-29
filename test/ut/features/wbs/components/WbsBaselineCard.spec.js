// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";

import WbsBaselineCard from "@/features/wbs/components/WbsBaselineCard.vue";
import {
  buildBaselineActivateControlKey,
  WBS_BASELINE_CONTROL,
} from "@/features/wbs/composables/useWbsBaselines";
import { mountWithUi } from "../../../support/mountWithUi";

const baseline = (baselineId, active) => ({
  baselineId,
  baselineNumber: baselineId,
  name: `計画${baselineId}`,
  description: null,
  active,
  createdBy: 1,
  createdAt: "2026-10-29T00:00:00Z",
  updatedBy: 1,
  updatedAt: "2026-10-29T00:00:00Z",
  version: 0,
});

const baseProps = {
  baselineList: { projectId: 1, baselines: [baseline(2, false), baseline(1, true)] },
  activeBaselineDetail: null,
  comparisonRows: [],
  canManage: true,
  isProjectActive: true,
  isLoading: false,
  isMutating: false,
  activatingBaselineId: null,
  errorMessages: [],
  successMessage: "",
};

describe("WbsBaselineCard", () => {
  let wrapper;

  afterEach(() => {
    wrapper?.unmount();
  });

  it("管理できるときは「現在計画を保存」と、activeでないbaselineの切替ボタンを出し、押すと通知する", async () => {
    wrapper = mountWithUi(WbsBaselineCard, { props: baseProps });

    const create = wrapper.find(`[data-wbs-baseline-control="${WBS_BASELINE_CONTROL.create}"]`);
    expect(create.exists()).toBe(true);
    const activate = wrapper.find(
      `[data-wbs-baseline-control="${buildBaselineActivateControlKey(2)}"]`
    );
    expect(activate.exists()).toBe(true);
    expect(
      wrapper.find(`[data-wbs-baseline-control="${buildBaselineActivateControlKey(1)}"]`).exists()
    ).toBe(false);

    await activate.trigger("click");
    expect(wrapper.emitted("activate")[0][0].baselineId).toBe(2);
  });

  it("管理できないときは、保存・切替のボタンを出さない", () => {
    wrapper = mountWithUi(WbsBaselineCard, { props: { ...baseProps, canManage: false } });

    expect(
      wrapper.find(`[data-wbs-baseline-control="${WBS_BASELINE_CONTROL.create}"]`).exists()
    ).toBe(false);
    expect(
      wrapper.find(`[data-wbs-baseline-control="${buildBaselineActivateControlKey(2)}"]`).exists()
    ).toBe(false);
  });

  it("baselineがないときは、状況に合った案内を出す（archive済みでは保存を促さない）", () => {
    wrapper = mountWithUi(WbsBaselineCard, {
      props: {
        ...baseProps,
        baselineList: { projectId: 1, baselines: [] },
        isProjectActive: false,
      },
    });

    expect(wrapper.text()).toContain("archive済みのProjectでは保存できません。");
  });
});
