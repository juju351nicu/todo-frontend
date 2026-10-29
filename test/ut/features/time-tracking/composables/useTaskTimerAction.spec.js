import { createPinia, setActivePinia } from "pinia";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ref } from "vue";

import {
  buildTaskTimerActionKey,
  useTaskTimerAction,
} from "@/features/time-tracking/composables/useTaskTimerAction";
import { useTaskTimerStore } from "@/features/time-tracking/stores/taskTimer";

vi.mock("@/app/router", () => ({ default: { push: vi.fn() } }));
vi.mock("@/features/auth/stores/user", () => ({
  useUserStore: () => ({ clearSession: vi.fn() }),
}));

const runningTimer = (projectId, taskId) => ({
  timerSessionId: 1,
  projectId,
  projectKey: "WORK",
  projectName: "Work Management",
  taskId,
  taskTitle: "計測中Task",
  startedAt: "2026-10-03T09:30:00+09:00",
  elapsedSeconds: 0,
  version: 0,
});

describe("useTaskTimerAction", () => {
  let timerStore;

  beforeEach(() => {
    setActivePinia(createPinia());
    timerStore = useTaskTimerStore();
    timerStore.initialized = true;
  });

  it("Timerがなければ開始可能にする", () => {
    const action = useTaskTimerAction({ projectId: 12, taskId: 345 });

    expect(action.isThisTaskRunning.value).toBe(false);
    expect(action.isAnotherTaskRunning.value).toBe(false);
    expect(action.isDisabled.value).toBe(false);
  });

  it("同じTaskを計測中なら停止可能にする", () => {
    timerStore.currentTimer = runningTimer(12, 345);
    const action = useTaskTimerAction({ projectId: 12, taskId: 345 });

    expect(action.isThisTaskRunning.value).toBe(true);
    expect(action.isDisabled.value).toBe(false);
  });

  it("別Taskを計測中なら無効にする", () => {
    timerStore.currentTimer = runningTimer(12, 999);
    const action = useTaskTimerAction({ projectId: 12, taskId: 345 });

    expect(action.isAnotherTaskRunning.value).toBe(true);
    expect(action.isDisabled.value).toBe(true);
  });

  it("Store未初期化・他の更新中・呼出側の無効指定では無効にする", () => {
    const disabled = ref(false);
    const action = useTaskTimerAction({ projectId: 12, taskId: 345, disabled });

    timerStore.initialized = false;
    expect(action.isDisabled.value).toBe(true);
    timerStore.initialized = true;
    timerStore.pendingMutation = "START";
    expect(action.isDisabled.value).toBe(true);
    timerStore.pendingMutation = null;
    disabled.value = true;
    expect(action.isDisabled.value).toBe(true);
  });

  it("開始・停止を対象TaskでStoreへ委譲する", async () => {
    const startTimer = vi.spyOn(timerStore, "startTimer").mockResolvedValue(true);
    const stopCurrentTimer = vi.spyOn(timerStore, "stopCurrentTimer").mockResolvedValue(true);
    const action = useTaskTimerAction({ projectId: () => 12, taskId: () => 345 });

    await action.startTimer();
    await action.stopTimer();

    expect(startTimer).toHaveBeenCalledWith(12, 345);
    expect(stopCurrentTimer).toHaveBeenCalledTimes(1);
  });

  describe("操作後のフォーカス", () => {
    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it.each([
      ["開始", "startTimer", "startTimer"],
      ["停止", "stopTimer", "stopCurrentTimer"],
    ])("%sの後、同じTaskのbuttonへフォーカスを戻す", async (_label, actionName, storeAction) => {
      vi.spyOn(timerStore, storeAction).mockResolvedValue(false);
      // 単体テストの実行環境にはDOMがないため、buttonを探すdocumentを差し替える。
      // 開始と停止でbuttonが切り替わりフォーカスが外れるため、操作後に探し直して戻すことを確かめる。
      const focus = vi.fn();
      const querySelector = vi.fn(() => ({ focus, matches: () => false }));
      vi.stubGlobal("document", { querySelector });
      const action = useTaskTimerAction({ projectId: () => 12, taskId: () => 345 });

      await action[actionName]();

      expect(querySelector).toHaveBeenCalledWith(
        `[data-task-timer-action="${buildTaskTimerActionKey(12, 345)}"]`
      );
      expect(focus).toHaveBeenCalledOnce();
    });
  });
});
