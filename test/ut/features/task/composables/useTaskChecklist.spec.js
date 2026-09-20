import { ref } from "vue";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TaskChecklistApiError } from "@/features/task/api/taskChecklistApi";
import { useTaskChecklist } from "@/features/task/composables/useTaskChecklist";

const mocks = vi.hoisted(() => ({
  router: { push: vi.fn() },
  taskChecklistApi: {
    createItem: vi.fn(),
    deleteItem: vi.fn(),
    findItems: vi.fn(),
    reorderItems: vi.fn(),
    updateItem: vi.fn(),
  },
  userStore: { clearSession: vi.fn() },
}));

vi.mock("vue-router", () => ({ useRouter: () => mocks.router }));
vi.mock("@/features/auth/stores/user", () => ({
  useUserStore: () => mocks.userStore,
}));
vi.mock("@/features/task/api/taskChecklistApi", async () => {
  const actual = await vi.importActual(
    "@/features/task/api/taskChecklistApi"
  );
  return { ...actual, default: mocks.taskChecklistApi };
});

const firstItem = {
  checklistItemId: 41,
  taskId: 31,
  content: "仕様を確認する",
  completed: false,
  position: 1000,
  createdBy: 7,
  createdAt: "2026-09-21T01:00:00Z",
  updatedBy: 7,
  updatedAt: "2026-09-21T01:00:00Z",
  version: 0,
};
const secondItem = {
  ...firstItem,
  checklistItemId: 42,
  content: "テストする",
  position: 2000,
};

const createPage = (disabled = false) =>
  useTaskChecklist(ref(5), ref(31), ref(disabled));

const waitForInitialLoad = async () => {
  await vi.waitFor(() => {
    expect(mocks.taskChecklistApi.findItems).toHaveBeenCalledWith(5, 31);
  });
};

describe("useTaskChecklist", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.router.push.mockResolvedValue(undefined);
    mocks.taskChecklistApi.findItems.mockResolvedValue([
      structuredClone(firstItem),
      structuredClone(secondItem),
    ]);
    mocks.taskChecklistApi.createItem.mockResolvedValue({
      ...firstItem,
      checklistItemId: 43,
      content: "レビューする",
      position: 3000,
    });
    mocks.taskChecklistApi.updateItem.mockImplementation(
      (_projectId, _taskId, _itemId, request) =>
        Promise.resolve({ ...firstItem, ...request, version: 1 })
    );
    mocks.taskChecklistApi.reorderItems.mockResolvedValue([
      { ...secondItem, position: 1000, version: 1 },
      { ...firstItem, position: 2000, version: 1 },
    ]);
    mocks.taskChecklistApi.deleteItem.mockResolvedValue(undefined);
  });

  it("初期表示で対象Taskのchecklistを取得する", async () => {
    const page = createPage();

    await waitForInitialLoad();

    expect(page.items.value).toEqual([firstItem, secondItem]);
    expect(page.completedCount.value).toBe(0);
  });

  it("本文をtrimして追加しBackend確定Responseを末尾へ反映する", async () => {
    const page = createPage();
    await waitForInitialLoad();
    page.newContent.value = "  レビューする  ";

    await page.addItem();

    expect(mocks.taskChecklistApi.createItem).toHaveBeenCalledWith(5, 31, {
      content: "レビューする",
    });
    expect(page.items.value.at(-1)?.checklistItemId).toBe(43);
    expect(page.newContent.value).toBe("");
  });

  it("取得時点versionを使用して完了状態を反転する", async () => {
    const page = createPage();
    await waitForInitialLoad();

    await page.toggleItem(page.items.value[0]);

    expect(mocks.taskChecklistApi.updateItem).toHaveBeenCalledWith(5, 31, 41, {
      content: "仕様を確認する",
      completed: true,
      version: 0,
    });
    expect(page.items.value[0]).toMatchObject({ completed: true, version: 1 });
  });

  it("上下移動後の全item ID・versionを送信して確定順へ置き換える", async () => {
    const page = createPage();
    await waitForInitialLoad();

    await page.moveItem(page.items.value[1], -1);

    expect(mocks.taskChecklistApi.reorderItems).toHaveBeenCalledWith(5, 31, {
      items: [
        { checklistItemId: 42, version: 0 },
        { checklistItemId: 41, version: 0 },
      ],
    });
    expect(page.items.value.map((item) => item.checklistItemId)).toEqual([
      42, 41,
    ]);
  });

  it("削除確認対象のversionを送り204成功後だけ一覧から除外する", async () => {
    const page = createPage();
    await waitForInitialLoad();
    page.openDeleteConfirm(page.items.value[0]);

    await page.confirmDelete();

    expect(mocks.taskChecklistApi.deleteItem).toHaveBeenCalledWith(
      5,
      31,
      41,
      0
    );
    expect(page.items.value.map((item) => item.checklistItemId)).toEqual([42]);
  });

  it("409競合では編集状態を破棄して最新一覧を再取得する", async () => {
    const latest = { ...firstItem, content: "別画面の更新", version: 1 };
    mocks.taskChecklistApi.findItems
      .mockResolvedValueOnce([structuredClone(firstItem)])
      .mockResolvedValueOnce([latest]);
    mocks.taskChecklistApi.updateItem.mockRejectedValue(
      new TaskChecklistApiError(409, {
        fieldErrors: [
          {
            errorCode: "TASK_CHECKLIST_VERSION_CONFLICT",
            field: "version",
            message: "別の操作で変更されました。",
          },
        ],
      })
    );
    const page = createPage();
    await waitForInitialLoad();
    page.startEditing(page.items.value[0]);
    page.editContent.value = "古い更新";

    await page.saveEdit();

    expect(mocks.taskChecklistApi.findItems).toHaveBeenCalledTimes(2);
    expect(page.items.value).toEqual([latest]);
    expect(page.editingItemId.value).toBeNull();
    expect(page.errorMessage.value).toBe("別の操作で変更されました。");
  });

  it("参照専用では更新系APIを呼び出さない", async () => {
    const page = createPage(true);
    await waitForInitialLoad();
    page.newContent.value = "追加";

    await page.addItem();
    await page.toggleItem(page.items.value[0]);
    await page.moveItem(page.items.value[1], -1);

    expect(mocks.taskChecklistApi.createItem).not.toHaveBeenCalled();
    expect(mocks.taskChecklistApi.updateItem).not.toHaveBeenCalled();
    expect(mocks.taskChecklistApi.reorderItems).not.toHaveBeenCalled();
  });

  it("401ではSession表示を破棄してLoginへ戻す", async () => {
    mocks.taskChecklistApi.findItems.mockRejectedValue(
      new TaskChecklistApiError(401, null)
    );

    createPage();
    await waitForInitialLoad();
    await vi.waitFor(() => {
      expect(mocks.userStore.clearSession).toHaveBeenCalledOnce();
      expect(mocks.router.push).toHaveBeenCalledWith({ name: "Login" });
    });
  });
});
