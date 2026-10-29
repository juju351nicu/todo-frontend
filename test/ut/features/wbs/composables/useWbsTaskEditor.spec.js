import { beforeEach, describe, expect, it, vi } from "vitest";

import { WbsApiError } from "@/features/wbs/api/wbsApi";
import { useWbsPage } from "@/features/wbs/composables/useWbsPage";
import {
  useWbsTaskEditor,
  WBS_TASK_EDITOR_CONTROL,
} from "@/features/wbs/composables/useWbsTaskEditor";
import { DISPLAY_MESSAGES } from "@/shared/constants/displayMessages";

import {
  buildWbsPageContext,
  mocks,
  project,
  wbs,
  updatedWbs,
  buildEditForm,
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

describe("useWbsTaskEditor", () => {
  beforeEach(resetWbsPageMocks);

  it("取得済みTaskから編集Dialogと循環しない親候補を開く", async () => {
    const page = useWbsPage();
    await page.initialize();

    page.openTaskEditor(2);

    expect(page.isEditorOpen.value).toBe(true);
    expect(page.editingTask.value).toMatchObject({ taskId: 2, version: 4 });
    expect(page.parentOptions.value).toEqual([
      { title: "最上位", value: null },
      { title: "1 Phase 1", value: 1 },
    ]);
  });

  it("TASK_UPDATEがなければ編集Dialogを開かない", async () => {
    mocks.permissions.delete("TASK_UPDATE");
    const page = useWbsPage();
    await page.initialize();

    page.openTaskEditor(2);

    expect(page.isEditorOpen.value).toBe(false);
    expect(page.errorMessages.value).toEqual([
      "WBSを更新するpermissionがありません。",
    ]);
  });

  it("MEMBERは自分が担当するTaskだけ編集でき、他人の担当Taskは入口を出さずDialogも開かない", async () => {
    const othersWbs = structuredClone(wbs);
    othersWbs.tasks = othersWbs.tasks.map((task) => ({ ...task, assigneeAccountId: 1 }));
    mocks.wbsApi.getWbs.mockResolvedValue(othersWbs);
    const page = useWbsPage();
    await page.initialize();

    expect(page.canEditTask({ assigneeAccountId: 2 })).toBe(true);
    expect(page.canEditTask({ assigneeAccountId: 1 })).toBe(false);

    page.openTaskEditor(2);

    expect(page.isEditorOpen.value).toBe(false);
    expect(page.errorMessages.value).toEqual([
      "担当していないTaskのWBS情報は編集できません。",
    ]);
  });

  it("OWNER・MANAGER・SYSTEM_ADMINは他人の担当Taskも編集できる", async () => {
    mocks.roles.add("SYSTEM_ADMIN");
    const page = useWbsPage();
    await page.initialize();

    expect(page.canEditTask({ assigneeAccountId: 1 })).toBe(true);
  });

  it("archive済みProjectでは担当Taskでも編集の入口を出さない", async () => {
    mocks.projectApi.getProject.mockResolvedValue({
      ...structuredClone(project),
      status: "ARCHIVED",
    });
    const page = useWbsPage();
    await page.initialize();

    expect(page.canEditTask({ assigneeAccountId: 2 })).toBe(false);
    page.openTaskEditor(2);
    expect(page.isEditorOpen.value).toBe(false);
    expect(page.errorMessages.value).toEqual([
      "archive済みのProjectのTaskは編集できません。",
    ]);
  });

  it("取得時点のversion付きRequestを送りResponse全体でWBSを更新する", async () => {
    const page = useWbsPage();
    await page.initialize();
    page.openTaskEditor(2);

    await page.saveWbsTask(buildEditForm());

    expect(mocks.wbsApi.updateWbsTask).toHaveBeenCalledWith(7, 2, {
      parentTaskId: 1,
      taskType: "TASK",
      wbsCode: "1.1",
      plannedStartDate: "2026-08-22",
      plannedEndDate: "2026-08-24",
      plannedEffortMinutes: 480,
      progressPercent: 50,
      actualStartDate: "2026-08-22",
      actualEndDate: "2026-08-24",
      version: 4,
    });
    expect(page.wbs.value).toEqual(updatedWbs);
    expect(page.isEditorOpen.value).toBe(false);
    expect(page.successMessage.value).toBe("WBS Taskを更新しました。");
  });

  it("入力不正では更新APIを呼ばずDialogへ理由を表示する", async () => {
    const page = useWbsPage();
    await page.initialize();
    page.openTaskEditor(2);

    await page.saveWbsTask(
      buildEditForm({
        plannedStartDate: "2026-08-24",
        plannedEndDate: "2026-08-22",
      })
    );

    expect(mocks.wbsApi.updateWbsTask).not.toHaveBeenCalled();
    expect(page.editorErrorMessages.value).toEqual([
      "予定終了日は予定開始日以降にしてください。",
    ]);
    expect(page.isEditorOpen.value).toBe(true);
  });

  it("実績終了日だけの入力では更新APIを呼ばない", async () => {
    const page = useWbsPage();
    await page.initialize();
    page.openTaskEditor(2);

    await page.saveWbsTask(
      buildEditForm({ actualStartDate: "", actualEndDate: "2026-08-24" })
    );

    expect(mocks.wbsApi.updateWbsTask).not.toHaveBeenCalled();
    expect(page.editorErrorMessages.value).toEqual([
      "実績終了日を入力する場合は実績開始日も入力してください。",
    ]);
    expect(page.isEditorOpen.value).toBe(true);
  });

  it("400の項目エラーをDialogへ表示して入力を保持する", async () => {
    mocks.wbsApi.updateWbsTask.mockRejectedValue(
      new WbsApiError(400, {
        fieldErrors: [
          {
            errorCode: "INVALID_WBS_HIERARCHY",
            field: "parentTaskId",
            message: "親Taskが不正です。",
          },
        ],
      })
    );
    const page = useWbsPage();
    await page.initialize();
    page.openTaskEditor(2);

    await page.saveWbsTask(buildEditForm());

    expect(page.editorErrorMessages.value).toEqual(["親Taskが不正です。"]);
    expect(page.isEditorOpen.value).toBe(true);
  });

  it("Dialogを開いたまま失敗を表示した後は「保存」へフォーカスを戻す", async () => {
    mocks.wbsApi.updateWbsTask.mockRejectedValue(new WbsApiError(400, null));
    const page = useWbsPage();
    await page.initialize();
    page.openTaskEditor(2);

    await page.saveWbsTask(buildEditForm());

    expect(mocks.focusedControls).toEqual([WBS_TASK_EDITOR_CONTROL.save]);
  });

  it("成功してDialogを閉じた場合はフォーカスを動かさない（UModalが編集ボタンへ戻す）", async () => {
    const page = useWbsPage();
    await page.initialize();
    page.openTaskEditor(2);

    await page.saveWbsTask(buildEditForm());

    expect(page.isEditorOpen.value).toBe(false);
    expect(mocks.focusedControls).toEqual([]);
  });

  it("契約済み400の複数messageをBackend順で表示する", async () => {
    mocks.wbsApi.updateWbsTask.mockRejectedValue(
      new WbsApiError(400, {
        fieldErrors: [
          {
            errorCode: "INVALID_REQUEST_BODY",
            field: "plannedEndDate",
            message: " 予定終了日を確認してください。 ",
          },
          {
            errorCode: "INVALID_WBS_ACTUAL_PERIOD",
            field: "actualEndDate",
            message: "実績期間を確認してください。",
          },
        ],
      })
    );
    const page = useWbsPage();
    await page.initialize();
    page.openTaskEditor(2);

    await page.saveWbsTask(buildEditForm());

    expect(page.editorErrorMessages.value).toEqual([
      "予定終了日を確認してください。",
      "実績期間を確認してください。",
    ]);
    expect(page.isEditorOpen.value).toBe(true);
  });

  it("未知codeのBackend messageを表示せずWBS更新fallbackへ閉じる", async () => {
    mocks.wbsApi.updateWbsTask.mockRejectedValue(
      new WbsApiError(400, {
        fieldErrors: [
          {
            errorCode: "UNKNOWN_WBS_ERROR",
            field: "request",
            message: "内部情報を含み得る未契約文言",
          },
        ],
      })
    );
    const page = useWbsPage();
    await page.initialize();
    page.openTaskEditor(2);

    await page.saveWbsTask(buildEditForm());

    expect(page.editorErrorMessages.value).toEqual([
      "WBS Taskを更新できませんでした。",
    ]);
    expect(page.isEditorOpen.value).toBe(true);
  });

  it("409競合ではDialogを閉じて最新WBSを再取得する", async () => {
    mocks.wbsApi.updateWbsTask.mockRejectedValue(
      new WbsApiError(409, {
        fieldErrors: [
          {
            errorCode: "TASK_VERSION_CONFLICT",
            field: "version",
            message: "他の操作で更新されています。",
          },
        ],
      })
    );
    mocks.wbsApi.getWbs
      .mockResolvedValueOnce(structuredClone(wbs))
      .mockResolvedValueOnce(structuredClone(updatedWbs));
    const page = useWbsPage();
    await page.initialize();
    page.openTaskEditor(2);

    await page.saveWbsTask(buildEditForm());

    expect(page.isEditorOpen.value).toBe(false);
    // 画面は取り直し済みなので、Backendの「再読み込みしてください」の後ろに取り直し済みの案内を添える。
    expect(page.errorMessages.value).toEqual([
      "他の操作で更新されています。",
      DISPLAY_MESSAGES.wbs.conflictReloaded,
    ]);
    expect(mocks.wbsApi.getWbs).toHaveBeenCalledTimes(2);
    expect(page.wbs.value).toEqual(updatedWbs);
  });

  it("archive済みTaskの409では、取り直しても編集できないので取り直し済みの案内を添えない", async () => {
    mocks.wbsApi.updateWbsTask.mockRejectedValue(
      new WbsApiError(409, {
        fieldErrors: [
          {
            errorCode: "TASK_ARCHIVED",
            field: "taskId",
            message: "archive済みTaskのWBSは変更できません。",
          },
        ],
      })
    );
    const page = useWbsPage();
    await page.initialize();
    page.openTaskEditor(2);

    await page.saveWbsTask(buildEditForm());

    expect(page.errorMessages.value).toEqual([
      "archive済みTaskのWBSは変更できません。",
    ]);
  });

  it("WBS更新409後の再取得で401になった場合は競合案内を残さない", async () => {
    mocks.wbsApi.updateWbsTask.mockRejectedValue(
      new WbsApiError(409, {
        fieldErrors: [
          {
            errorCode: "TASK_VERSION_CONFLICT",
            field: "version",
            message: "他の操作で更新されています。",
          },
        ],
      })
    );
    mocks.wbsApi.getWbs
      .mockResolvedValueOnce(structuredClone(wbs))
      .mockRejectedValueOnce(new WbsApiError(401, null));
    const page = useWbsPage();
    await page.initialize();
    page.openTaskEditor(2);

    await page.saveWbsTask(buildEditForm());

    expect(page.errorMessages.value).toEqual([]);
    expect(page.isEditorOpen.value).toBe(false);
    expect(mocks.userStore.clearSession).toHaveBeenCalledOnce();
    expect(mocks.router.push).toHaveBeenCalledWith({ name: "Login" });
  });

  it("保存中の再実行では更新APIを二重送信しない", async () => {
    let resolveRequest;
    mocks.wbsApi.updateWbsTask.mockImplementation(
      () => new Promise((resolve) => (resolveRequest = resolve))
    );
    const page = useWbsPage();
    await page.initialize();
    page.openTaskEditor(2);

    const firstSave = page.saveWbsTask(buildEditForm());
    const secondSave = page.saveWbsTask(buildEditForm());

    expect(mocks.wbsApi.updateWbsTask).toHaveBeenCalledOnce();
    resolveRequest(updatedWbs);
    await Promise.all([firstSave, secondSave]);
  });

  it("更新APIの401は古いDialogとSessionを破棄してログインへ戻す", async () => {
    mocks.wbsApi.updateWbsTask.mockRejectedValue(new WbsApiError(401, null));
    const page = useWbsPage();
    await page.initialize();
    page.openTaskEditor(2);

    await page.saveWbsTask(buildEditForm());

    expect(page.isEditorOpen.value).toBe(false);
    expect(mocks.userStore.clearSession).toHaveBeenCalledOnce();
    expect(mocks.router.push).toHaveBeenCalledWith({ name: "Login" });
  });
  describe("contextを直接渡した場合", () => {
    /** 通常Task 2の編集Dialogを開いた状態を作る。WBS再取得と画面全体の参照エラー処理はmockにする。 */
    const openTaskEditor = (contextOverrides = {}) => {
      const context = buildWbsPageContext(contextOverrides);
      const options = {
        reloadWbs: vi.fn(async () => {}),
        handleReadApiError: vi.fn(async () => {}),
      };
      const state = useWbsTaskEditor(context, options);
      state.openTaskEditor(2);
      return { context, options, state };
    };

    it("Summaryを親候補にし、編集中Task自身は親候補に含めない", () => {
      const { state } = openTaskEditor();

      expect(state.isEditorOpen.value).toBe(true);
      expect(state.parentOptions.value.map((option) => option.value)).toContain(1);
      expect(state.parentOptions.value.map((option) => option.value)).not.toContain(2);
    });

    it.each([
      [new WbsApiError(403, null), DISPLAY_MESSAGES.wbs.updateForbidden],
      [new WbsApiError(404, null), DISPLAY_MESSAGES.wbs.taskNotFound],
      [new TypeError("Failed to fetch"), DISPLAY_MESSAGES.common.connectionFailed],
    ])("更新失敗%sではDialogを開いたまま理由を表示する", async (error, message) => {
      mocks.wbsApi.updateWbsTask.mockRejectedValue(error);
      const { context, options, state } = openTaskEditor();

      await state.saveWbsTask(buildEditForm());

      expect(state.isEditorOpen.value).toBe(true);
      expect(state.editorErrorMessages.value).toEqual([message]);
      expect(context.wbs.value).toEqual(wbs);
      expect(options.reloadWbs).not.toHaveBeenCalled();
    });

    it("409後のWBS再取得が500なら競合理由に再読込案内を追加する", async () => {
      mocks.wbsApi.updateWbsTask.mockRejectedValue(new WbsApiError(409, null));
      const { context, options, state } = openTaskEditor();
      options.reloadWbs.mockRejectedValue(new WbsApiError(500, null));

      await state.saveWbsTask(buildEditForm());

      expect(state.isEditorOpen.value).toBe(false);
      expect(context.errorMessages.value).toEqual([
        DISPLAY_MESSAGES.wbs.conflict,
        DISPLAY_MESSAGES.wbs.reloadFailed,
      ]);
      expect(options.handleReadApiError).not.toHaveBeenCalled();
    });

    it("保存中はDialogを閉じず、保存確定後に閉じる", async () => {
      let resolveUpdate;
      mocks.wbsApi.updateWbsTask.mockReturnValueOnce(
        new Promise((resolve) => {
          resolveUpdate = resolve;
        })
      );
      const { context, state } = openTaskEditor();

      const saving = state.saveWbsTask(buildEditForm());
      state.closeTaskEditor();
      expect(state.isEditorOpen.value).toBe(true);
      resolveUpdate(structuredClone(updatedWbs));
      await saving;

      expect(state.isEditorOpen.value).toBe(false);
      expect(state.editingTask.value).toBeNull();
      expect(context.wbs.value).toEqual(updatedWbs);
      expect(context.successMessage.value).toBe("WBS Taskを更新しました。");
    });
  });
});
