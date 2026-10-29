// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";

import WorkingCalendarCard from "@/features/wbs/components/WorkingCalendarCard.vue";
import { buildWorkingDayEditControlKey } from "@/features/wbs/composables/useWbsWorkingCalendar";
import { mountWithUi } from "../../../support/mountWithUi";

const day = (workDate) => ({
  workDate,
  dayType: "WORKING",
  availableMinutes: 480,
  source: "DEFAULT",
  projectOverride: null,
  memberOverride: null,
});

const baseProps = {
  dateRange: { dateFrom: "2026-11-02", dateTo: "2026-11-03" },
  calendar: { projectId: 1, accountId: null, days: [day("2026-11-02"), day("2026-11-03")] },
  targetOptions: [{ value: "PROJECT", label: "Project共通" }],
  selectedTargetKey: "PROJECT",
  canEditSelectedTarget: true,
  readOnlyMessage: null,
  isLoading: false,
  isMutating: false,
  errorMessages: [],
  successMessage: "",
};

describe("WorkingCalendarCard", () => {
  let wrapper;

  afterEach(() => {
    wrapper?.unmount();
  });

  it("変更できるときは日ごとの「変更」を出し、押した日を通知する", async () => {
    wrapper = mountWithUi(WorkingCalendarCard, { props: baseProps });

    const edit = wrapper.find(
      `[data-working-calendar-control="${buildWorkingDayEditControlKey("2026-11-03")}"]`
    );
    expect(edit.exists()).toBe(true);
    await edit.trigger("click");

    expect(wrapper.emitted("edit")).toEqual([["2026-11-03"]]);
  });

  it("変更できないときは操作を出さず、理由の案内を出す", () => {
    wrapper = mountWithUi(WorkingCalendarCard, {
      props: {
        ...baseProps,
        canEditSelectedTarget: false,
        readOnlyMessage: "archive済みのProjectでは変更できません。",
      },
    });

    expect(
      wrapper
        .find(`[data-working-calendar-control="${buildWorkingDayEditControlKey("2026-11-02")}"]`)
        .exists()
    ).toBe(false);
    expect(wrapper.text()).toContain("archive済みのProjectでは変更できません。");
  });
});
