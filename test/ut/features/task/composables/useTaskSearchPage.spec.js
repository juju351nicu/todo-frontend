import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TaskSearchApiError } from "@/features/task/api/taskSearchApi";
import {
  TASK_SEARCH_CONTROL,
  useTaskSearchPage,
} from "@/features/task/composables/useTaskSearchPage";
import { DISPLAY_MESSAGES } from "@/shared/constants/displayMessages";

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
    const latestSavedView = {
      ...savedView,
      name: "担当Task（最新）",
      filters: { ...emptyFilters, statusCode: "TODO" },
      visibleColumns: ["STATUS", "ASSIGNEE"],
      version: 3,
    };
    const conflict = new TaskSearchApiError(409, {
      fieldErrors: [
        {
          errorCode: "TASK_SAVED_VIEW_VERSION_CONFLICT",
          field: "version",
          message: "他の画面で更新されています。",
        },
      ],
    });
    mocks.api.updateTaskSavedView.mockRejectedValue(conflict);
    mocks.api.getTaskSavedViews
      .mockResolvedValueOnce([savedView])
      .mockResolvedValueOnce([latestSavedView]);
    const page = useTaskSearchPage();
    await page.initialize();
    await page.applySavedView(5);
    page.savedViewName.value = "古い編集値";
    page.filters.keyword = "古い検索条件";
    page.visibleColumns.value = ["DETAIL"];

    await page.updateSavedView();

    expect(mocks.api.updateTaskSavedView).toHaveBeenCalledWith(
      5,
      expect.objectContaining({ version: 2 })
    );
    expect(mocks.api.getTaskSavedViews).toHaveBeenCalledTimes(2);
    expect(page.activeSavedView.value?.version).toBe(3);
    expect(page.savedViewName.value).toBe("担当Task（最新）");
    expect(page.filters.keyword).toBe("");
    expect(page.filters.statusCode).toBe("TODO");
    expect(page.visibleColumns.value).toEqual(["STATUS", "ASSIGNEE"]);
    expect(page.errorMessages.value).toEqual([
      "他の画面で更新されています。",
      "最新のSaved Viewを再取得しました。内容を確認してから、もう一度操作してください。",
    ]);
  });

  it("更新競合でSaved Viewを取り直したら、最新の条件で検索し直す（改善提案 1-16）", async () => {
    const latestSavedView = {
      ...savedView,
      filters: { ...emptyFilters, statusCode: "TODO" },
      version: 3,
    };
    mocks.api.updateTaskSavedView.mockRejectedValue(
      new TaskSearchApiError(409, {
        fieldErrors: [
          {
            errorCode: "TASK_SAVED_VIEW_VERSION_CONFLICT",
            field: "version",
            message: "他の画面で更新されています。",
          },
        ],
      })
    );
    mocks.api.getTaskSavedViews
      .mockResolvedValueOnce([savedView])
      .mockResolvedValueOnce([latestSavedView]);
    const page = useTaskSearchPage();
    await page.initialize();
    await page.applySavedView(5);
    mocks.api.searchTasks.mockClear();

    await page.updateSavedView();

    expect(mocks.api.searchTasks).toHaveBeenCalledOnce();
    expect(mocks.api.searchTasks).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: "TODO" })
    );
    expect(page.tasks.value).toEqual(searchResponse.tasks);
    // 検索し直しても、取り直しの案内は消さない。
    expect(page.errorMessages.value).toEqual([
      "他の画面で更新されています。",
      "最新のSaved Viewを再取得しました。内容を確認してから、もう一度操作してください。",
    ]);
  });

  it("取り直し後の検索し直しで401になったら、案内を足さずLoginへ移る", async () => {
    mocks.api.updateTaskSavedView.mockRejectedValue(
      new TaskSearchApiError(409, {
        fieldErrors: [
          {
            errorCode: "TASK_SAVED_VIEW_VERSION_CONFLICT",
            field: "version",
            message: "他の画面で更新されています。",
          },
        ],
      })
    );
    mocks.api.getTaskSavedViews
      .mockResolvedValueOnce([savedView])
      .mockResolvedValueOnce([savedView]);
    const page = useTaskSearchPage();
    await page.initialize();
    await page.applySavedView(5);
    mocks.api.searchTasks.mockRejectedValueOnce(new TaskSearchApiError(401, null));

    await page.updateSavedView();

    expect(mocks.userStore.clearSession).toHaveBeenCalledOnce();
    expect(mocks.router.push).toHaveBeenCalledWith({ name: "Login" });
    expect(page.errorMessages.value).toEqual([]);
  });

  it("検索条件の契約済み複数errorをBackend順で表示する", async () => {
    mocks.api.searchTasks.mockRejectedValue(
      new TaskSearchApiError(400, {
        fieldErrors: [
          {
            errorCode: "TASK_SEARCH_KEYWORD_INVALID",
            field: "keyword",
            message: "検索語を確認してください。",
          },
          {
            errorCode: "TASK_SEARCH_PRIORITY_INVALID",
            field: "priority",
            message: "優先度を確認してください。",
          },
        ],
      })
    );
    const page = useTaskSearchPage();

    await page.executeSearch();

    expect(page.errorMessages.value).toEqual([
      "検索語を確認してください。",
      "優先度を確認してください。",
    ]);
  });

  it("未知error codeのBackend本文を表示せず検索fallbackへ閉じる", async () => {
    mocks.api.searchTasks.mockRejectedValue(
      new TaskSearchApiError(400, {
        fieldErrors: [
          {
            errorCode: "UNKNOWN_SEARCH_ERROR",
            field: "keyword",
            message: "内部情報を含む本文",
          },
        ],
      })
    );
    const page = useTaskSearchPage();

    await page.executeSearch();

    expect(page.errorMessages.value).toEqual([
      DISPLAY_MESSAGES.task.search.searchFailed,
    ]);
  });

  it("検索403ではSessionを維持し古い検索結果を破棄する", async () => {
    const page = useTaskSearchPage();
    await page.initialize();
    mocks.api.searchTasks.mockRejectedValue(new TaskSearchApiError(403, null));

    await page.executeSearch();

    expect(page.tasks.value).toEqual([]);
    expect(page.errorMessages.value).toEqual([
      DISPLAY_MESSAGES.task.search.readForbidden,
    ]);
    expect(mocks.userStore.clearSession).not.toHaveBeenCalled();
    expect(mocks.router.push).not.toHaveBeenCalled();
  });

  it("Saved View更新404では古い選択とversionを破棄する", async () => {
    mocks.api.updateTaskSavedView.mockRejectedValue(
      new TaskSearchApiError(404, {
        fieldErrors: [
          {
            errorCode: "TASK_SAVED_VIEW_NOT_FOUND",
            field: "savedViewId",
            message: "対象がありません。",
          },
        ],
      })
    );
    mocks.api.getTaskSavedViews
      .mockResolvedValueOnce([savedView])
      .mockResolvedValueOnce([]);
    const page = useTaskSearchPage();
    await page.initialize();
    await page.applySavedView(5);

    await page.updateSavedView();

    expect(page.savedViews.value).toEqual([]);
    expect(page.selectedSavedViewId.value).toBeNull();
    expect(page.savedViewName.value).toBe("");
    expect(page.activeSavedView.value).toBeNull();
    expect(page.errorMessages.value).toEqual([
      DISPLAY_MESSAGES.task.search.resourceNotFound,
    ]);
  });

  it("競合回復中の401を優先しSessionと古いSaved Viewを破棄する", async () => {
    mocks.api.updateTaskSavedView.mockRejectedValue(
      new TaskSearchApiError(409, {
        fieldErrors: [
          {
            errorCode: "TASK_SAVED_VIEW_VERSION_CONFLICT",
            field: "version",
            message: "競合しました。",
          },
        ],
      })
    );
    mocks.api.getTaskSavedViews
      .mockResolvedValueOnce([savedView])
      .mockRejectedValueOnce(new TaskSearchApiError(401, null));
    const page = useTaskSearchPage();
    await page.initialize();
    await page.applySavedView(5);

    await page.updateSavedView();

    expect(page.savedViews.value).toEqual([]);
    expect(page.selectedSavedViewId.value).toBeNull();
    expect(page.errorMessages.value).toEqual([]);
    expect(mocks.userStore.clearSession).toHaveBeenCalledOnce();
    expect(mocks.router.push).toHaveBeenCalledWith({ name: "Login" });
  });

  it.each([
    [403, DISPLAY_MESSAGES.task.search.readForbidden],
    [404, DISPLAY_MESSAGES.task.search.resourceNotFound],
  ])(
    "競合回復中の%sを古い409より優先する",
    async (reloadStatus, expectedMessage) => {
      mocks.api.updateTaskSavedView.mockRejectedValue(
        new TaskSearchApiError(409, {
          fieldErrors: [
            {
              errorCode: "TASK_SAVED_VIEW_VERSION_CONFLICT",
              field: "version",
              message: "競合しました。",
            },
          ],
        })
      );
      mocks.api.getTaskSavedViews
        .mockResolvedValueOnce([savedView])
        .mockRejectedValueOnce(new TaskSearchApiError(reloadStatus, null));
      const page = useTaskSearchPage();
      await page.initialize();
      await page.applySavedView(5);

      await page.updateSavedView();

      expect(page.savedViews.value).toEqual([]);
      expect(page.selectedSavedViewId.value).toBeNull();
      expect(page.errorMessages.value).toEqual([expectedMessage]);
      expect(mocks.userStore.clearSession).not.toHaveBeenCalled();
    }
  );

  it("競合回復中の通信失敗では競合理由と再取得失敗を併記する", async () => {
    mocks.api.updateTaskSavedView.mockRejectedValue(
      new TaskSearchApiError(409, {
        fieldErrors: [
          {
            errorCode: "TASK_SAVED_VIEW_VERSION_CONFLICT",
            field: "version",
            message: "競合しました。",
          },
        ],
      })
    );
    mocks.api.getTaskSavedViews
      .mockResolvedValueOnce([savedView])
      .mockRejectedValueOnce(new TypeError("Failed to fetch"));
    const page = useTaskSearchPage();
    await page.initialize();
    await page.applySavedView(5);

    await page.updateSavedView();

    expect(page.savedViews.value).toEqual([]);
    expect(page.errorMessages.value).toEqual([
      "競合しました。",
      DISPLAY_MESSAGES.task.search.reloadFailed,
    ]);
  });

  it("登録確定後の一覧再取得失敗を登録失敗と誤表示しない", async () => {
    const created = { ...savedView, savedViewId: 6, version: 1 };
    mocks.api.createTaskSavedView.mockResolvedValue(created);
    mocks.api.getTaskSavedViews.mockRejectedValue(
      new TypeError("Failed to fetch")
    );
    const page = useTaskSearchPage();
    page.savedViewName.value = "新しいView";

    await page.createSavedView();

    expect(page.savedViews.value).toEqual([]);
    expect(page.errorMessages.value).toEqual([
      DISPLAY_MESSAGES.task.search.savedRefreshFailed,
    ]);
    expect(page.errorMessages.value).not.toContain(
      DISPLAY_MESSAGES.task.search.createFailed
    );
  });

  it("期限（から）が期限（まで）より後ならAPIを呼ばず画面で検証する", async () => {
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

  it("Saved View適用中の候補取得401では検索を続行しない", async () => {
    const page = useTaskSearchPage();
    await page.initialize();
    mocks.api.getTaskSearchOptions.mockRejectedValue(
      new TaskSearchApiError(401, null)
    );
    mocks.api.searchTasks.mockClear();

    await page.applySavedView(5);

    expect(mocks.api.searchTasks).not.toHaveBeenCalled();
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

  it("キーワードが100文字を超えるときは検索APIを呼ばず、項目名の入った文言を出す", async () => {
    const page = useTaskSearchPage();
    await page.initialize();
    mocks.api.searchTasks.mockClear();
    page.filters.keyword = "あ".repeat(101);

    await page.executeSearch();

    expect(mocks.api.searchTasks).not.toHaveBeenCalled();
    expect(page.errorMessages.value).toEqual(["キーワードは100文字以内で入力してください。"]);
  });

  describe("Saved Viewの操作の後のフォーカス", () => {
    // 単体テストの実行環境にはDOMがないため、部品を探すdocumentを差し替える。
    const stubDocument = () => {
      const focused = [];
      vi.stubGlobal("document", {
        querySelector: (selector) => ({
          focus: () => focused.push(selector.match(/data-task-search-control="([^"]+)"/)?.[1]),
          matches: () => false,
        }),
      });
      return focused;
    };

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it("更新の409の後はSaved View名へ、削除の後は「保存した条件」へ戻す", async () => {
      mocks.api.getTaskSavedViews.mockResolvedValue([savedView]);
      mocks.api.updateTaskSavedView.mockRejectedValue(
        new TaskSearchApiError(409, {
          fieldErrors: [{ errorCode: "TASK_SAVED_VIEW_VERSION_CONFLICT", field: "version", message: "他の画面で更新されています。" }],
        })
      );
      const page = useTaskSearchPage();
      await page.initialize();
      await page.applySavedView(5);
      const focused = stubDocument();

      await page.updateSavedView();
      await page.deleteSavedView();

      expect(focused).toEqual([TASK_SEARCH_CONTROL.savedViewName, TASK_SEARCH_CONTROL.savedViewSelect]);
    });
  });
});
