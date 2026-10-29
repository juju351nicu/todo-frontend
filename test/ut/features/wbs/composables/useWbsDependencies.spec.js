import { beforeEach, describe, expect, it, vi } from "vitest";
import { computed, ref } from "vue";

import { WbsApiError } from "@/features/wbs/api/wbsApi";
import { useWbsDependencies } from "@/features/wbs/composables/useWbsDependencies";
import { useWbsPage } from "@/features/wbs/composables/useWbsPage";
import { DISPLAY_MESSAGES } from "@/shared/constants/displayMessages";

import {
  buildWbsPageContext,
  mocks,
  wbs,
  updatedWbs,
  dependencyList,
  updatedDependencyList,
  resetWbsPageMocks,
} from "./wbsPageTestSupport";

vi.mock("vue-router", async () => {
  const { mocks } = await import("./wbsPageTestSupport");
  return { useRoute: () => mocks.route, useRouter: () => mocks.router };
});
vi.mock("@/features/auth/stores/user", async () => {
  const { mocks } = await import("./wbsPageTestSupport");
  return { useUserStore: () => mocks.userStore };
});
vi.mock("@/features/project/api/projectApi", async () => {
  const actual = await vi.importActual("@/features/project/api/projectApi");
  const { mocks } = await import("./wbsPageTestSupport");
  return { ...actual, default: mocks.projectApi };
});
vi.mock("@/features/wbs/api/wbsApi", async () => {
  const actual = await vi.importActual("@/features/wbs/api/wbsApi");
  const { mocks } = await import("./wbsPageTestSupport");
  return { ...actual, default: mocks.wbsApi };
});

describe("useWbsDependencies", () => {
  beforeEach(resetWbsPageMocks);

  it("TASK_UPDATEと2件以上のTaskがあれば依存関係追加Dialogを開く", async () => {
    const page = useWbsPage();
    await page.initialize();

    page.openDependencyEditor();

    expect(page.isDependencyEditorOpen.value).toBe(true);
    expect(page.dependencyTaskOptions.value).toEqual([
      { title: "1 Phase 1", value: 1 },
      { title: "1.1 実装", value: 2 },
      { title: "1.2 完了判定", value: 3 },
    ]);
  });

  it("TASK_UPDATEがなければ依存関係追加Dialogを開かない", async () => {
    mocks.permissions.delete("TASK_UPDATE");
    const page = useWbsPage();
    await page.initialize();

    page.openDependencyEditor();

    expect(page.isDependencyEditorOpen.value).toBe(false);
    expect(page.dependencyErrorMessages.value).toEqual([
      "Task依存関係を更新するpermissionがありません。",
    ]);
  });

  it("Finish-to-Startと待ち時間を送信してBackendの依存関係一覧へ差し替える", async () => {
    const page = useWbsPage();
    await page.initialize();
    page.openDependencyEditor();

    await page.saveDependency({
      predecessorTaskId: 2,
      successorTaskId: 3,
      lagMinutes: 30,
    });

    expect(mocks.wbsApi.createTaskDependency).toHaveBeenCalledWith(7, {
      predecessorTaskId: 2,
      successorTaskId: 3,
      dependencyType: "FINISH_TO_START",
      lagMinutes: 30,
    });
    expect(page.dependencies.value).toEqual(updatedDependencyList.dependencies);
    expect(page.isDependencyEditorOpen.value).toBe(false);
    expect(page.dependencySuccessMessage.value).toBe("Task依存関係を追加しました。");
  });

  it("同じTask・負の待ち時間・重複方向では作成APIを呼ばない", async () => {
    const page = useWbsPage();
    await page.initialize();
    page.openDependencyEditor();

    await page.saveDependency({
      predecessorTaskId: 1,
      successorTaskId: 1,
      lagMinutes: -1,
    });
    expect(page.dependencyEditorErrorMessages.value).toEqual([
      "先行Taskと後続Taskには別のTaskを選択してください。",
      "待ち時間は0以上の整数で入力してください。",
    ]);

    await page.saveDependency({
      predecessorTaskId: 1,
      successorTaskId: 2,
      lagMinutes: 0,
    });
    expect(page.dependencyEditorErrorMessages.value).toEqual([
      "同じ向きのTask依存関係はすでに登録されています。",
    ]);
    expect(mocks.wbsApi.createTaskDependency).not.toHaveBeenCalled();
  });

  it("作成APIの400項目エラーをDialogへ表示して入力を保持する", async () => {
    mocks.wbsApi.createTaskDependency.mockRejectedValue(
      new WbsApiError(400, {
        fieldErrors: [
          {
            errorCode: "INVALID_TASK_DEPENDENCY",
            field: "successorTaskId",
            message: "循環するため登録できません。",
          },
        ],
      })
    );
    const page = useWbsPage();
    await page.initialize();
    page.openDependencyEditor();

    await page.saveDependency({
      predecessorTaskId: 2,
      successorTaskId: 3,
      lagMinutes: 0,
    });

    expect(page.dependencyEditorErrorMessages.value).toEqual(["循環するため登録できません。"]);
    expect(page.isDependencyEditorOpen.value).toBe(true);
  });

  it("作成APIの403と404をpermission不足・対象なしとして区別する", async () => {
    mocks.wbsApi.createTaskDependency.mockRejectedValueOnce(new WbsApiError(403, null));
    const forbiddenPage = useWbsPage();
    await forbiddenPage.initialize();
    forbiddenPage.openDependencyEditor();
    await forbiddenPage.saveDependency({
      predecessorTaskId: 2,
      successorTaskId: 3,
      lagMinutes: 0,
    });

    mocks.wbsApi.createTaskDependency.mockRejectedValueOnce(new WbsApiError(404, null));
    const missingPage = useWbsPage();
    await missingPage.initialize();
    missingPage.openDependencyEditor();
    await missingPage.saveDependency({
      predecessorTaskId: 2,
      successorTaskId: 3,
      lagMinutes: 0,
    });

    expect(forbiddenPage.dependencyEditorErrorMessages.value).toEqual([
      "Task依存関係を更新するpermissionがありません。",
    ]);
    expect(missingPage.dependencyEditorErrorMessages.value).toEqual([
      "対象のProjectまたはTaskが見つかりません。",
    ]);
    expect(forbiddenPage.isDependencyEditorOpen.value).toBe(true);
    expect(missingPage.isDependencyEditorOpen.value).toBe(true);
  });

  it("作成APIの409ではDialogを閉じてWBSと依存関係を再取得する", async () => {
    mocks.wbsApi.createTaskDependency.mockRejectedValue(
      new WbsApiError(409, {
        fieldErrors: [
          {
            errorCode: "TASK_DEPENDENCY_ALREADY_EXISTS",
            field: "successorTaskId",
            message: "Taskが更新されています。",
          },
        ],
      })
    );
    mocks.wbsApi.getWbs
      .mockResolvedValueOnce(structuredClone(wbs))
      .mockResolvedValueOnce(structuredClone(updatedWbs));
    mocks.wbsApi.getTaskDependencies
      .mockResolvedValueOnce(structuredClone(dependencyList))
      .mockResolvedValueOnce(structuredClone(updatedDependencyList));
    const page = useWbsPage();
    await page.initialize();
    page.openDependencyEditor();

    await page.saveDependency({
      predecessorTaskId: 2,
      successorTaskId: 3,
      lagMinutes: 0,
    });

    expect(page.isDependencyEditorOpen.value).toBe(false);
    expect(page.dependencyErrorMessages.value).toEqual(["Taskが更新されています。"]);
    // 依存関係cardは画面下部にあるため、操作結果は画面上部の共通messageへは出さない。
    expect(page.errorMessages.value).toEqual([]);
    expect(mocks.wbsApi.getWbs).toHaveBeenCalledTimes(2);
    expect(mocks.wbsApi.getTaskDependencies).toHaveBeenCalledTimes(2);
    expect(page.wbs.value).toEqual(updatedWbs);
    expect(page.dependencies.value).toEqual(updatedDependencyList.dependencies);
  });

  it("依存関係409後の再取得で401になった場合は競合案内を残さない", async () => {
    mocks.wbsApi.createTaskDependency.mockRejectedValue(
      new WbsApiError(409, {
        fieldErrors: [
          {
            errorCode: "TASK_DEPENDENCY_ALREADY_EXISTS",
            field: "successorTaskId",
            message: "依存関係が登録されています。",
          },
        ],
      })
    );
    mocks.wbsApi.getWbs
      .mockResolvedValueOnce(structuredClone(wbs))
      .mockRejectedValueOnce(new WbsApiError(401, null));
    const page = useWbsPage();
    await page.initialize();
    page.openDependencyEditor();

    await page.saveDependency({
      predecessorTaskId: 2,
      successorTaskId: 3,
      lagMinutes: 0,
    });

    expect(page.errorMessages.value).toEqual([]);
    expect(page.isDependencyEditorOpen.value).toBe(false);
    expect(mocks.userStore.clearSession).toHaveBeenCalledOnce();
    expect(mocks.router.push).toHaveBeenCalledWith({ name: "Login" });
  });

  it("依存関係保存中の再実行では作成APIを二重送信しない", async () => {
    let resolveRequest;
    mocks.wbsApi.createTaskDependency.mockImplementation(
      () => new Promise((resolve) => (resolveRequest = resolve))
    );
    const page = useWbsPage();
    await page.initialize();
    page.openDependencyEditor();
    const form = {
      predecessorTaskId: 2,
      successorTaskId: 3,
      lagMinutes: 0,
    };

    const firstSave = page.saveDependency(form);
    const secondSave = page.saveDependency(form);

    expect(mocks.wbsApi.createTaskDependency).toHaveBeenCalledOnce();
    resolveRequest(updatedDependencyList);
    await Promise.all([firstSave, secondSave]);
  });

  it("取得時点versionを確認後に削除し204確定後だけ一覧から除外する", async () => {
    const page = useWbsPage();
    await page.initialize();

    page.requestDependencyDelete(31);
    expect(page.dependencyPendingDelete.value).toMatchObject({
      dependencyId: 31,
      version: 3,
    });
    await page.confirmDependencyDelete();

    expect(mocks.wbsApi.deleteTaskDependency).toHaveBeenCalledWith(7, 31, 3);
    expect(page.dependencies.value).toEqual([]);
    expect(page.dependencyPendingDelete.value).toBeNull();
    expect(page.dependencySuccessMessage.value).toBe("Task依存関係を削除しました。");
  });

  it("削除確認をキャンセルした場合はAPIを呼ばない", async () => {
    const page = useWbsPage();
    await page.initialize();

    page.requestDependencyDelete(31);
    page.cancelDependencyDelete();

    expect(page.dependencyPendingDelete.value).toBeNull();
    expect(mocks.wbsApi.deleteTaskDependency).not.toHaveBeenCalled();
  });

  it("削除APIの409では確認対象を破棄して最新一覧を再取得する", async () => {
    mocks.wbsApi.deleteTaskDependency.mockRejectedValue(
      new WbsApiError(409, {
        fieldErrors: [
          {
            errorCode: "TASK_DEPENDENCY_VERSION_CONFLICT",
            field: "version",
            message: "更新されています。",
          },
        ],
      })
    );
    mocks.wbsApi.getTaskDependencies
      .mockResolvedValueOnce(structuredClone(dependencyList))
      .mockResolvedValueOnce(structuredClone(updatedDependencyList));
    const page = useWbsPage();
    await page.initialize();
    page.requestDependencyDelete(31);

    await page.confirmDependencyDelete();

    expect(page.dependencyPendingDelete.value).toBeNull();
    expect(page.dependencyErrorMessages.value).toEqual(["更新されています。"]);
    expect(mocks.wbsApi.getTaskDependencies).toHaveBeenCalledTimes(2);
    expect(page.dependencies.value).toEqual(updatedDependencyList.dependencies);
  });

  it("削除APIの401は確認対象とSessionを破棄してログインへ戻す", async () => {
    mocks.wbsApi.deleteTaskDependency.mockRejectedValue(new WbsApiError(401, null));
    const page = useWbsPage();
    await page.initialize();
    page.requestDependencyDelete(31);

    await page.confirmDependencyDelete();

    expect(page.dependencyPendingDelete.value).toBeNull();
    expect(mocks.userStore.clearSession).toHaveBeenCalledOnce();
    expect(mocks.router.push).toHaveBeenCalledWith({ name: "Login" });
  });

  describe("contextを直接渡した場合", () => {
    /** 取得済み依存関係（Task 1→2）を持つ依存関係操作を、画面全体の再取得をmockにして作る。 */
    const buildDependencies = (contextOverrides = {}) => {
      const context = buildWbsPageContext(contextOverrides);
      const options = {
        dependencyList: ref(structuredClone(dependencyList)),
        reloadPageSnapshot: vi.fn(async () => {}),
        handleReadApiError: vi.fn(async () => {}),
      };
      return { context, options, state: useWbsDependencies(context, options) };
    };

    it("一覧行へ階層表と同じWBSコード付きTask名を付ける", () => {
      const { state } = buildDependencies();

      expect(state.dependencyRows.value).toEqual([
        expect.objectContaining({
          dependencyId: 31,
          predecessorLabel: "1 Phase 1",
          successorLabel: "1.1 実装",
        }),
      ]);
      expect(state.dependencyTaskOptions.value.map((option) => option.value)).toEqual([1, 2, 3]);
    });

    it("削除確認dialogを閉じたときだけ確認対象を破棄する", () => {
      const { state } = buildDependencies();
      state.requestDependencyDelete(31);
      expect(state.dependencyPendingDeleteRow.value?.dependencyId).toBe(31);

      state.handleDependencyDeleteDialogVisibility(true);
      expect(state.dependencyPendingDelete.value).not.toBeNull();
      state.handleDependencyDeleteDialogVisibility(false);
      expect(state.dependencyPendingDelete.value).toBeNull();
      expect(state.dependencyPendingDeleteRow.value).toBeNull();
    });

    it("削除APIの403では確認Dialogを閉じ、権限不足を依存関係card内へ表示する", async () => {
      mocks.wbsApi.deleteTaskDependency.mockRejectedValue(new WbsApiError(403, null));
      const { options, state } = buildDependencies();
      state.requestDependencyDelete(31);

      await state.confirmDependencyDelete();

      // 開いたままだとcard内の案内が確認Dialogの裏に隠れ、押しても何も起きないように見えるため閉じる。
      expect(state.dependencyPendingDelete.value).toBeNull();
      expect(state.dependencyErrorMessages.value).toEqual([
        DISPLAY_MESSAGES.wbs.dependency.forbidden,
      ]);
      expect(options.dependencyList.value.dependencies).toHaveLength(1);
      expect(options.reloadPageSnapshot).not.toHaveBeenCalled();
    });

    it("Project管理権限のないMEMBERには、本人担当のTaskだけを追加候補にし、担当外を含む行は削除させない", () => {
      const { context, state } = buildDependencies();
      // Task 2だけを別のaccountの担当にする（既定のログイン利用者はaccountId 2のMEMBER）。
      context.wbs.value.tasks = context.wbs.value.tasks.map((task) =>
        task.taskId === 2 ? { ...task, assigneeAccountId: 9 } : task
      );

      expect(state.dependencyTaskOptions.value.map((option) => option.value)).toEqual([1, 3]);
      // 依存関係31はTask 1→2。担当外のTask 2を含むので削除できない。
      expect(state.dependencyRows.value[0].canDelete).toBe(false);
      state.requestDependencyDelete(31);
      expect(state.dependencyPendingDelete.value).toBeNull();
      expect(state.dependencyErrorMessages.value).toEqual([
        DISPLAY_MESSAGES.wbs.dependency.forbidden,
      ]);
    });

    it("Project管理権限があれば担当者に関係なく全Taskを候補にし、全行を削除できる", () => {
      const { context, state } = buildDependencies({ canManageProject: computed(() => true) });
      context.wbs.value.tasks = context.wbs.value.tasks.map((task) => ({
        ...task,
        assigneeAccountId: 9,
      }));

      expect(state.dependencyTaskOptions.value.map((option) => option.value)).toEqual([1, 2, 3]);
      expect(state.dependencyRows.value[0].canDelete).toBe(true);
    });

    it("TASK_UPDATEがなければ候補も削除可能な行もない", () => {
      const { state } = buildDependencies({ canEditWbs: computed(() => false) });

      expect(state.dependencyTaskOptions.value).toEqual([]);
      expect(state.dependencyRows.value[0].canDelete).toBe(false);
    });

    it("競合後の画面再取得が500なら競合理由に再読込案内を追加する", async () => {
      mocks.wbsApi.deleteTaskDependency.mockRejectedValue(new WbsApiError(409, null));
      const { options, state } = buildDependencies();
      options.reloadPageSnapshot.mockRejectedValue(new WbsApiError(500, null));
      state.requestDependencyDelete(31);

      await state.confirmDependencyDelete();

      expect(state.dependencyErrorMessages.value).toEqual([
        DISPLAY_MESSAGES.wbs.dependency.stale,
        DISPLAY_MESSAGES.wbs.dependency.reloadFailed,
      ]);
      expect(options.handleReadApiError).not.toHaveBeenCalled();
    });

    it("競合後の画面再取得が403なら画面全体の参照エラー処理へ委ねる", async () => {
      mocks.wbsApi.createTaskDependency.mockRejectedValue(new WbsApiError(409, null));
      const forbidden = new WbsApiError(403, null);
      const { options, state } = buildDependencies({ canManageProject: computed(() => true) });
      options.reloadPageSnapshot.mockRejectedValue(forbidden);
      state.openDependencyEditor();

      await state.saveDependency({ predecessorTaskId: 2, successorTaskId: 3, lagMinutes: 0 });

      expect(state.isDependencyEditorOpen.value).toBe(false);
      expect(options.handleReadApiError).toHaveBeenCalledWith(forbidden);
    });

    it("作成APIの通信失敗ではDialogを開いたまま接続失敗を表示する", async () => {
      mocks.wbsApi.createTaskDependency.mockRejectedValue(new TypeError("Failed to fetch"));
      const { state } = buildDependencies();
      state.openDependencyEditor();

      await state.saveDependency({ predecessorTaskId: 2, successorTaskId: 3, lagMinutes: 0 });

      expect(state.isDependencyEditorOpen.value).toBe(true);
      expect(state.dependencyEditorErrorMessages.value).toEqual([
        DISPLAY_MESSAGES.common.connectionFailed,
      ]);
    });
  });
});
