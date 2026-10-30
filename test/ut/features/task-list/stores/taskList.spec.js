import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";

import TaskListApi from "@/features/task-list/api/taskListApi";
import { useTaskListStore } from "@/features/task-list/stores/taskList";

vi.mock("@/features/task-list/api/taskListApi", () => ({
  default: {
    complete: vi.fn(),
    findCalendar: vi.fn(),
    findDetail: vi.fn(),
    findList: vi.fn(),
    upsert: vi.fn(),
  },
}));

describe("Task一覧のstore", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it("Backendと一致するURLとパラメータ名でTaskを完了にする", async () => {
    TaskListApi.complete.mockResolvedValue(undefined);
    const store = useTaskListStore();

    await expect(store.completeTask(42)).resolves.toBeUndefined();

    expect(TaskListApi.complete).toHaveBeenCalledWith(42);
  });

  it("ID指定でTask詳細を取得し、処理中フラグを解除する", async () => {
    const taskDetail = {
      task_id: 42,
      date_from: "2026-08-08",
      date_to: "2026-08-31",
      title: "詳細API対応",
      detail: "再読み込みに対応する",
      done_flag: "0",
      user_id: 1,
      priority: 2,
      version: 4,
    };
    TaskListApi.findDetail.mockResolvedValue(taskDetail);
    const store = useTaskListStore();

    const request = store.findTaskDetail(42);

    expect(store.isLoading).toBe(true);
    await expect(request).resolves.toEqual(taskDetail);
    expect(TaskListApi.findDetail).toHaveBeenCalledWith(42);
    expect(store.isLoading).toBe(false);
  });

  it("Task詳細APIが失敗しても処理中フラグを解除する", async () => {
    TaskListApi.findDetail.mockRejectedValue(new Error("Task APIの実行に失敗しました。status=404"));
    const store = useTaskListStore();

    await expect(store.findTaskDetail(999)).rejects.toThrow("Task APIの実行に失敗しました");
    expect(store.isLoading).toBe(false);
  });
});
