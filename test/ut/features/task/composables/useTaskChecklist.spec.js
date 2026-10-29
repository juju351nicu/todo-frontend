import { ref } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TaskChecklistApiError } from "@/features/task/api/taskChecklistApi";
import {
  buildChecklistControlKey,
  useTaskChecklist,
} from "@/features/task/composables/useTaskChecklist";
import { DISPLAY_MESSAGES } from "@/shared/constants/displayMessages";

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

  it("Taskを切り替えた後に前のTaskのchecklistが届いても、今のTaskのchecklistを上書きしない", async () => {
    let resolvePreviousTaskList;
    mocks.taskChecklistApi.findItems
      .mockReturnValueOnce(new Promise((resolve) => { resolvePreviousTaskList = resolve; }))
      .mockResolvedValueOnce([{ ...firstItem, taskId: 40, content: "今のTaskのchecklist" }]);
    const taskId = ref(31);
    const page = useTaskChecklist(ref(5), taskId, ref(false));

    taskId.value = 40;
    await vi.waitFor(() => {
      expect(page.items.value.map((entry) => entry.content)).toEqual(["今のTaskのchecklist"]);
    });
    resolvePreviousTaskList([structuredClone(firstItem)]);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(page.items.value.map((entry) => entry.content)).toEqual(["今のTaskのchecklist"]);
    expect(page.isLoading.value).toBe(false);
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
            errorCode: "CHECKLIST_VERSION_CONFLICT",
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
    // 画面はすでに最新一覧を表示しているので、Backendの文言に再取得済みの案内を添える。
    expect(page.errorMessages.value).toEqual([
      "別の操作で変更されました。",
      DISPLAY_MESSAGES.task.checklist.conflictReloaded,
    ]);
  });

  it("409でBackendの文言を表示できないときは固定の文言と再取得済みの案内を出す", async () => {
    mocks.taskChecklistApi.findItems
      .mockResolvedValueOnce([structuredClone(firstItem)])
      .mockResolvedValueOnce([structuredClone(firstItem)]);
    mocks.taskChecklistApi.updateItem.mockRejectedValue(
      new TaskChecklistApiError(409, null)
    );
    const page = createPage();
    await waitForInitialLoad();

    await page.toggleItem(page.items.value[0]);

    expect(page.errorMessages.value).toEqual([
      DISPLAY_MESSAGES.task.checklist.conflictFallback,
      DISPLAY_MESSAGES.task.checklist.conflictReloaded,
    ]);
  });

  it("契約済みcodeの複数項目エラーをBackend順で表示する", async () => {
    mocks.taskChecklistApi.reorderItems.mockRejectedValue(
      new TaskChecklistApiError(400, {
        fieldErrors: [
          {
            errorCode: "INVALID_CHECKLIST_ORDER",
            field: "items[0].version",
            message: "versionは0以上で指定してください。",
          },
          {
            errorCode: "INVALID_CHECKLIST_ORDER",
            field: "items[1].checklistItemId",
            message: "checklist item IDは正の値で指定してください。",
          },
        ],
      })
    );
    const page = createPage();
    await waitForInitialLoad();

    await page.moveItem(page.items.value[1], -1);

    expect(page.errorMessages.value).toEqual([
      "versionは0以上で指定してください。",
      "checklist item IDは正の値で指定してください。",
    ]);
  });

  it("未知codeを含むBackend本文は表示せず固定fallbackへ置き換える", async () => {
    mocks.taskChecklistApi.updateItem.mockRejectedValue(
      new TaskChecklistApiError(500, {
        fieldErrors: [
          {
            errorCode: "INTERNAL_SQL_DETAIL",
            field: "sql",
            message: "公開してはいけない内部情報",
          },
        ],
      })
    );
    const page = createPage();
    await waitForInitialLoad();

    await page.toggleItem(page.items.value[0]);

    expect(page.errorMessages.value).toEqual([
      DISPLAY_MESSAGES.task.checklist.toggleFailed,
    ]);
  });

  it("409回復中の401を古い競合より優先し一覧を破棄してLoginへ戻す", async () => {
    mocks.taskChecklistApi.findItems
      .mockResolvedValueOnce([structuredClone(firstItem)])
      .mockRejectedValueOnce(new TaskChecklistApiError(401, null));
    mocks.taskChecklistApi.updateItem.mockRejectedValue(
      new TaskChecklistApiError(409, {
        fieldErrors: [
          {
            errorCode: "CHECKLIST_VERSION_CONFLICT",
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

    expect(page.items.value).toEqual([]);
    expect(page.editingItemId.value).toBeNull();
    expect(page.errorMessages.value).toEqual([]);
    expect(mocks.userStore.clearSession).toHaveBeenCalledOnce();
    expect(mocks.router.push).toHaveBeenCalledWith({ name: "Login" });
  });

  it("409回復中の通信失敗では元の競合と再取得失敗を区別して表示する", async () => {
    mocks.taskChecklistApi.findItems
      .mockResolvedValueOnce([structuredClone(firstItem)])
      .mockRejectedValueOnce(new TypeError("Failed to fetch"));
    mocks.taskChecklistApi.updateItem.mockRejectedValue(
      new TaskChecklistApiError(409, {
        fieldErrors: [
          {
            errorCode: "CHECKLIST_VERSION_CONFLICT",
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

    expect(page.errorMessages.value).toEqual([
      "別の操作で変更されました。",
      DISPLAY_MESSAGES.task.checklist.reloadFailed,
    ]);
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

    const page = createPage();
    await waitForInitialLoad();
    await vi.waitFor(() => {
      expect(mocks.userStore.clearSession).toHaveBeenCalledOnce();
      expect(mocks.router.push).toHaveBeenCalledWith({ name: "Login" });
    });
    expect(page.items.value).toEqual([]);
    expect(page.errorMessages.value).toEqual([]);
  });

  it("完了済み項目の割合を整数の百分率で返し、項目がなければ0にする", async () => {
    const page = createPage();
    await waitForInitialLoad();

    page.items.value = [];
    expect(page.progressPercent.value).toBe(0);
    page.items.value = [
      { ...firstItem, completed: true },
      { ...secondItem, completed: false },
      { ...secondItem, checklistItemId: 44, completed: false },
    ];
    expect(page.progressPercent.value).toBe(33);
  });

  it.each([
    ["", false],
    ["a".repeat(255), true],
    ["a".repeat(256), false],
  ])("編集本文%#の保存可否はtrim後の長さで判定する", async (content, expected) => {
    const page = createPage();
    await waitForInitialLoad();

    page.editContent.value = content;

    expect(page.canSaveEdit.value).toBe(expected);
  });

  it("更新中に続けて操作しても2件目の更新APIは呼ばない", async () => {
    let resolveUpdate;
    mocks.taskChecklistApi.updateItem.mockImplementation(
      (_projectId, _taskId, _itemId, request) =>
        new Promise((resolve) => {
          resolveUpdate = () => resolve({ ...firstItem, ...request, version: 1 });
        })
    );
    const page = createPage();
    await waitForInitialLoad();

    const first = page.toggleItem(page.items.value[0]);
    await page.toggleItem(page.items.value[1]);
    await page.moveItem(page.items.value[0], 1);
    resolveUpdate();
    await first;

    expect(mocks.taskChecklistApi.updateItem).toHaveBeenCalledOnce();
    expect(mocks.taskChecklistApi.reorderItems).not.toHaveBeenCalled();
    expect(page.isMutating.value).toBe(false);
  });

  it("50件登録済みでは追加できない", async () => {
    const page = createPage();
    await waitForInitialLoad();
    page.newContent.value = "追加項目";
    page.items.value = Array.from({ length: 50 }, (_, index) => ({ ...firstItem, checklistItemId: index + 1 }));

    expect(page.canAdd.value).toBe(false);
  });

  describe("操作後のフォーカス", () => {
    // 単体テストの実行環境にはDOMがないため、部品を探すdocumentを差し替える。
    // 更新中は全部品がdisabledになりフォーカスが外れるため、操作後に探し直して戻すことを確かめる。
    // disabledKeys に含めた属性値の部品は disabled として扱う。
    const stubDocument = (disabledKeys = []) => {
      const focused = [];
      const querySelector = vi.fn((selector) => {
        const key = selector.match(/data-checklist-control="([^"]+)"/)?.[1];
        return {
          focus: () => focused.push(key),
          matches: () => disabledKeys.includes(key),
        };
      });
      vi.stubGlobal("document", { querySelector });
      return focused;
    };

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it("完了状態を切り替えた後、その項目のcheckboxへフォーカスを戻す", async () => {
      const focused = stubDocument();
      const page = createPage();
      await waitForInitialLoad();

      await page.toggleItem(page.items.value[0]);

      expect(focused).toEqual([buildChecklistControlKey(41, "toggle")]);
    });

    it("完了状態の切替に失敗した場合もcheckboxへフォーカスを戻す", async () => {
      mocks.taskChecklistApi.updateItem.mockRejectedValue(new TypeError("Failed to fetch"));
      const focused = stubDocument();
      const page = createPage();
      await waitForInitialLoad();

      await page.toggleItem(page.items.value[0]);

      expect(page.errorMessages.value).toEqual([DISPLAY_MESSAGES.common.connectionFailed]);
      expect(focused).toEqual([buildChecklistControlKey(41, "toggle")]);
    });

    it("下へ移動した後、同じ項目の下へ移動ボタンへフォーカスを戻す", async () => {
      const focused = stubDocument();
      const page = createPage();
      await waitForInitialLoad();

      await page.moveItem(page.items.value[0], 1);

      expect(focused).toEqual([buildChecklistControlKey(41, "move-down")]);
    });

    it("末尾へ移動して下へ移動ボタンがdisabledなら、上へ移動ボタンへフォーカスを戻す", async () => {
      const focused = stubDocument([buildChecklistControlKey(41, "move-down")]);
      const page = createPage();
      await waitForInitialLoad();

      await page.moveItem(page.items.value[0], 1);

      expect(focused).toEqual([buildChecklistControlKey(41, "move-up")]);
    });

    it("本文を保存した後、その項目の編集ボタンへフォーカスを戻す", async () => {
      const focused = stubDocument();
      const page = createPage();
      await waitForInitialLoad();
      page.startEditing(page.items.value[0]);
      page.editContent.value = "仕様を読む";

      await page.saveEdit();

      expect(page.editingItemId.value).toBeNull();
      expect(focused).toEqual([buildChecklistControlKey(41, "edit")]);
    });

    it("保存に失敗して編集欄が残る場合は、フォーカスを動かさない", async () => {
      mocks.taskChecklistApi.updateItem.mockRejectedValue(new TypeError("Failed to fetch"));
      const focused = stubDocument();
      const page = createPage();
      await waitForInitialLoad();
      page.startEditing(page.items.value[0]);
      page.editContent.value = "仕様を読む";

      await page.saveEdit();

      expect(page.editingItemId.value).toBe(41);
      expect(focused).toEqual([]);
    });

    it("取消・Escで編集をやめると、本文を捨てて編集ボタンへフォーカスを戻す", async () => {
      const focused = stubDocument();
      const page = createPage();
      await waitForInitialLoad();
      page.startEditing(page.items.value[1]);
      page.editContent.value = "保存しない本文";

      await page.discardEditing();

      expect(page.editingItemId.value).toBeNull();
      expect(page.editContent.value).toBe("");
      expect(mocks.taskChecklistApi.updateItem).not.toHaveBeenCalled();
      expect(focused).toEqual([buildChecklistControlKey(42, "edit")]);
    });
  });
});
