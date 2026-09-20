import { beforeEach, describe, expect, it, vi } from "vitest";

import { TaskSearchApiError } from "@/features/task/api/taskSearchApi";
import { useTaskSearchPage } from "@/features/task/composables/useTaskSearchPage";

const mocks = vi.hoisted(() => ({
  api: {
    createTaskSavedView: vi.fn(),
    deleteTaskSavedView: vi.fn(),
    getTaskSavedViews: vi.fn(),
    getTaskSearchOptions: vi.fn(),
    searchTasks: vi.fn(),
    updateTaskSavedView: vi.fn(),
  },
  router: { push: vi.fn() },
  userStore: { clearSession: vi.fn() },
}));

vi.mock("vue-router", () => ({ useRouter: () => mocks.router }));
vi.mock("@/features/auth/stores/user", () => ({
  useUserStore: () => mocks.userStore,
}));
vi.mock("@/features/task/api/taskSearchApi", async () => {
  const actual = await vi.importActual("@/features/task/api/taskSearchApi");
  return { ...actual, ...mocks.api };
});

const options = {
  projects: [{ projectId: 7, projectKey: "WM", projectName: "Work Management" }],
  assignees: [{ accountId: 11, loginId: "member", displayName: "担当者" }],
  statuses: [{ statusCode: "TODO", statusName: "未着手" }],
};
const task = {
  taskId: 31,
  projectId: 7,
  projectKey: "WM",
  projectName: "Work Management",
  taskStatusId: 2,
  statusCode: "TODO",
  statusName: "未着手",
  completed: false,
  title: "検索対象Task",
  detail: "詳細",
  dateFrom: "2026-09-20",
  dueDate: "2026-09-22",
  dueGroup: "UPCOMING",
  remainingDays: 2,
  assigneeAccountId: 11,
  assigneeLoginId: "member",
  assigneeDisplayName: "担当者",
  priority: 2,
  progressPercent: 20,
  version: 1,
};
const emptyFilters = {
  keyword: "",
  projectId: null,
  assigneeAccountId: null,
  statusCode: null,
  dueFrom: null,
  dueTo: null,
  priority: null,
};
const savedView = {
  savedViewId: 5,
  name: "担当Task",
  filters: { ...emptyFilters, projectId: 7, assigneeAccountId: 11 },
  visibleColumns: ["PROJECT", "DUE_DATE"],
  updatedAt: "2026-09-20T01:00:00Z",
  version: 2,
};
const searchResponse = {
  businessDate: "2026-09-20",
  truncated: false,
  tasks: [task],
};

describe("useTaskSearchPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.router.push.mockResolvedValue(undefined);
    mocks.api.getTaskSearchOptions.mockResolvedValue(options);
    mocks.api.getTaskSavedViews.mockResolvedValue([savedView]);
    mocks.api.searchTasks.mockResolvedValue(searchResponse);
  });

  it("初期表示で候補・Saved View・Taskを並行取得する", async () => {
    const page = useTaskSearchPage();

    await page.initialize();

    expect(mocks.api.getTaskSearchOptions).toHaveBeenCalledWith(null);
    expect(mocks.api.getTaskSavedViews).toHaveBeenCalledOnce();
    expect(mocks.api.searchTasks).toHaveBeenCalledWith(emptyFilters);
    expect(page.options.value).toEqual(options);
    expect(page.savedViews.value).toEqual([savedView]);
    expect(page.tasks.value).toEqual([task]);
  });

  it("Saved View適用時に条件・表示列・検索結果を復元する", async () => {
    const page = useTaskSearchPage();
    await page.initialize();

    await page.applySavedView(5);

    expect(page.filters.projectId).toBe(7);
    expect(page.filters.assigneeAccountId).toBe(11);
    expect(page.visibleColumns.value).toEqual(["PROJECT", "DUE_DATE"]);
    expect(mocks.api.getTaskSearchOptions).toHaveBeenLastCalledWith(7);
    expect(mocks.api.searchTasks).toHaveBeenLastCalledWith(savedView.filters);
  });

  it("現在の検索条件と表示列を本人Saved Viewとして登録する", async () => {
    const created = { ...savedView, savedViewId: 6, version: 1 };
    mocks.api.createTaskSavedView.mockResolvedValue(created);
    mocks.api.getTaskSavedViews.mockResolvedValue([savedView, created]);
    const page = useTaskSearchPage();
    page.savedViewName.value = "新しいView";

    await page.createSavedView();

    expect(mocks.api.createTaskSavedView).toHaveBeenCalledWith({
      name: "新しいView",
      filters: emptyFilters,
      visibleColumns: [
        "PROJECT",
        "STATUS",
        "ASSIGNEE",
        "PRIORITY",
        "DUE_DATE",
        "PROGRESS",
      ],
    });
    expect(page.selectedSavedViewId.value).toBe(6);
    expect(page.successMessage.value).toBe("Saved Viewを登録しました。");
  });

  it("更新競合ではSaved Viewを再取得しBackendメッセージを表示する", async () => {
    const conflict = new TaskSearchApiError(409, {
      fieldErrors: [{ field: "version", message: "他の画面で更新されています。" }],
    });
    mocks.api.updateTaskSavedView.mockRejectedValue(conflict);
    const page = useTaskSearchPage();
    await page.initialize();
    await page.applySavedView(5);

    await page.updateSavedView();

    expect(mocks.api.updateTaskSavedView).toHaveBeenCalledWith(
      5,
      expect.objectContaining({ version: 2 })
    );
    expect(mocks.api.getTaskSavedViews).toHaveBeenCalledTimes(2);
    expect(page.errorMessages.value).toEqual(["他の画面で更新されています。"]);
  });

  it("期限FromがToより後ならAPIを呼ばず画面で検証する", async () => {
    const page = useTaskSearchPage();
    page.filters.dueFrom = "2026-09-30";
    page.filters.dueTo = "2026-09-01";

    await page.executeSearch();

    expect(mocks.api.searchTasks).not.toHaveBeenCalled();
    expect(page.errorMessages.value).toEqual([
      "期限の終了日は開始日以降にしてください。",
    ]);
  });

  it("401ではSession表示を破棄してLoginへ戻す", async () => {
    mocks.api.searchTasks.mockRejectedValue(new TaskSearchApiError(401, null));
    const page = useTaskSearchPage();

    await page.executeSearch();

    expect(mocks.userStore.clearSession).toHaveBeenCalledOnce();
    expect(mocks.router.push).toHaveBeenCalledWith({ name: "Login" });
  });

  it("検索結果の所属Project BoardへTask ID付きで移動する", async () => {
    const page = useTaskSearchPage();

    await page.showTask(task);

    expect(mocks.router.push).toHaveBeenCalledWith({
      name: "TaskBoard",
      params: { projectId: 7 },
      query: { taskId: "31" },
    });
  });
});
