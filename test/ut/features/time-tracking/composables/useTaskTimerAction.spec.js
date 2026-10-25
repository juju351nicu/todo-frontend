import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ref } from "vue";

import { useTaskTimerAction } from "@/features/time-tracking/composables/useTaskTimerAction";
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
});
