// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import AppSnackbar from "@/shared/components/AppSnackbar.vue";
import { mountWithUi } from "../../support/mountWithUi";

describe("AppSnackbar", () => {
  let wrapper;

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    wrapper?.unmount();
    vi.useRealTimers();
  });

  it("表示から timeout が過ぎたら、閉じることを親へ通知する", () => {
    wrapper = mountWithUi(AppSnackbar, { props: { open: true, color: "success", timeout: 3000 }, slots: { default: "保存しました" } });

    vi.advanceTimersByTime(2999);
    expect(wrapper.emitted("update:open")).toBeUndefined();
    vi.advanceTimersByTime(1);
    expect(wrapper.emitted("update:open")).toEqual([[false]]);
  });

  it("続けて表示し直したら、最後の表示から timeout だけ残す", async () => {
    wrapper = mountWithUi(AppSnackbar, { props: { open: true, color: "info", timeout: 3000 } });

    vi.advanceTimersByTime(2000);
    await wrapper.setProps({ open: false });
    await wrapper.setProps({ open: true });
    vi.advanceTimersByTime(2000);
    expect(wrapper.emitted("update:open")).toBeUndefined();
    vi.advanceTimersByTime(1000);
    expect(wrapper.emitted("update:open")).toEqual([[false]]);
  });

  it("timeout が 0 以下なら自動で閉じない", () => {
    wrapper = mountWithUi(AppSnackbar, { props: { open: true, color: "error", timeout: 0 } });

    vi.advanceTimersByTime(60000);
    expect(wrapper.emitted("update:open")).toBeUndefined();
  });
});
