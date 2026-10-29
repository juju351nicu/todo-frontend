// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";

import AttendancePunchPanel from "@/features/attendance/components/AttendancePunchPanel.vue";
import { mountWithUi } from "../../../support/mountWithUi";

const baseProps = {
  workDate: "2026-10-29",
  displayName: "勤怠 太郎",
  punchState: "OFF_DUTY",
  canClockIn: true,
  canClockOut: false,
  canStartBreak: false,
  canEndBreak: false,
  canWriteAttendance: true,
  isPunching: false,
  isToday: true,
};

describe("AttendancePunchPanel", () => {
  let wrapper;

  afterEach(() => {
    wrapper?.unmount();
  });

  const punchButton = (action) => wrapper.find(`[data-attendance-punch="${action}"]`);

  it("打刻できるボタンだけを押せるようにし、押した打刻の種類を通知する", async () => {
    wrapper = mountWithUi(AttendancePunchPanel, { props: baseProps });

    expect(punchButton("clock-in").attributes("disabled")).toBeUndefined();
    expect(punchButton("clock-out").attributes("disabled")).toBeDefined();
    expect(punchButton("break-start").attributes("disabled")).toBeDefined();
    expect(punchButton("break-end").attributes("disabled")).toBeDefined();
    await punchButton("clock-in").trigger("click");

    expect(wrapper.emitted("punch")).toEqual([["clock-in"]]);
  });

  it("打刻の送信中は、打刻できるボタンも押せない", () => {
    wrapper = mountWithUi(AttendancePunchPanel, { props: { ...baseProps, isPunching: true } });

    expect(punchButton("clock-in").attributes("disabled")).toBeDefined();
  });

  it("更新のpermissionがなければ参照のみの案内、今日以外の未出勤なら出勤は今日だけの案内を出す", () => {
    wrapper = mountWithUi(AttendancePunchPanel, {
      props: { ...baseProps, canWriteAttendance: false },
    });
    expect(wrapper.text()).toContain("参照のみです");
    wrapper.unmount();

    wrapper = mountWithUi(AttendancePunchPanel, { props: { ...baseProps, isToday: false } });
    expect(wrapper.text()).toContain("出勤打刻は本日の詳細を選択した場合だけ実行できます。");
    expect(wrapper.text()).not.toContain("参照のみです");
  });
});
