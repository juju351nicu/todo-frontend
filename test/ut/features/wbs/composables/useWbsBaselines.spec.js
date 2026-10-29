import { beforeEach, describe, expect, it, vi } from "vitest";
import { computed, ref } from "vue";

import { WbsApiError } from "@/features/wbs/api/wbsApi";
import {
  buildBaselineActivateControlKey,
  useWbsBaselines,
} from "@/features/wbs/composables/useWbsBaselines";
import { useWbsPage } from "@/features/wbs/composables/useWbsPage";
import { DISPLAY_MESSAGES } from "@/shared/constants/displayMessages";

import {
  baselineCreateResponse,
  baselineList,
  baselineSummary,
  buildWbsPageContext,
  inactiveBaselineSummary,
  mocks,
  project,
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

describe("useWbsBaselines", () => {
  beforeEach(resetWbsPageMocks);

  it("Project MANAGERは現在計画をtrim済みbaselineとして保存する", async () => {
    mocks.projectApi.getProject.mockResolvedValue(
      structuredClone({
        ...project,
        members: project.members.map((member) =>
          member.accountId === 2
            ? { ...member, projectRole: "MANAGER" }
            : member
        ),
      })
    );
    const page = useWbsPage();
    await page.initialize();

    page.openBaselineCreateDialog();
    await page.saveWbsBaseline({
      name: "  8月再計画  ",
      description: "  仕様確定後  ",
    });

    expect(mocks.wbsApi.createWbsBaseline).toHaveBeenCalledWith(7, {
      name: "8月再計画",
      description: "仕様確定後",
    });
    expect(page.isBaselineCreateDialogOpen.value).toBe(false);
    expect(page.baselineSuccessMessage.value).toContain(
      "Task 3件、依存関係 1件、日別予定 2件"
    );
    expect(mocks.wbsApi.getWbsBaselines).toHaveBeenCalledTimes(2);
  });

  it("通常Project memberはbaseline作成Dialogを開けない", async () => {
    const page = useWbsPage();
    await page.initialize();

    page.openBaselineCreateDialog();

    expect(page.isBaselineCreateDialogOpen.value).toBe(false);
    expect(page.baselineErrorMessages.value).toEqual([
      "baselineを作成するにはProjectのOWNERまたはMANAGER権限が必要です。",
    ]);
    expect(mocks.wbsApi.createWbsBaseline).not.toHaveBeenCalled();
  });

  it("不正なbaseline FormはAPIへ送らずDialogへ全理由を表示する", async () => {
    mocks.roles.add("SYSTEM_ADMIN");
    const page = useWbsPage();
    await page.initialize();
    page.openBaselineCreateDialog();

    await page.saveWbsBaseline({
      name: " ",
      description: "a".repeat(1001),
    });

    expect(mocks.wbsApi.createWbsBaseline).not.toHaveBeenCalled();
    expect(page.baselineEditorErrorMessages.value).toEqual([
      "baseline名を入力してください。",
      "説明は1000文字以内で入力してください。",
    ]);
    expect(page.isBaselineCreateDialogOpen.value).toBe(true);
  });

  it("Project OWNERは取得時点versionで保存済みbaselineを比較対象へ切り替える", async () => {
    mocks.userStore.accountId = 1;
    const page = useWbsPage();
    await page.initialize();

    await page.activateWbsBaseline(inactiveBaselineSummary);

    expect(mocks.wbsApi.activateWbsBaseline).toHaveBeenCalledWith(7, 20, {
      version: 2,
    });
    expect(page.baselineSuccessMessage.value).toBe(
      "baseline「初期計画」を有効化しました。"
    );
    expect(mocks.wbsApi.getWbsBaselines).toHaveBeenCalledTimes(2);
  });

  it("baseline有効化の409競合では理由を表示して最新一覧を再取得する", async () => {
    mocks.userStore.accountId = 1;
    mocks.wbsApi.activateWbsBaseline.mockRejectedValue(
      new WbsApiError(409, {
        fieldErrors: [
          {
            errorCode: "WBS_BASELINE_VERSION_CONFLICT",
            field: "version",
            message: "更新されています。",
          },
        ],
      })
    );
    const page = useWbsPage();
    await page.initialize();

    await page.activateWbsBaseline(inactiveBaselineSummary);

    // 一覧は取り直し済みなので、Backendの「最新状態を取得してください」の後ろに取り直し済みの案内を添える。
    expect(page.baselineErrorMessages.value).toEqual([
      "更新されています。",
      DISPLAY_MESSAGES.wbs.baseline.conflictReloaded,
    ]);
    expect(mocks.wbsApi.getWbsBaselines).toHaveBeenCalledTimes(2);
    expect(page.activatingBaselineId.value).toBeNull();
  });

  it("archive済みProjectの409では、取り直しても操作できないので取り直し済みの案内を添えない", async () => {
    mocks.userStore.accountId = 1;
    mocks.wbsApi.activateWbsBaseline.mockRejectedValue(
      new WbsApiError(409, {
        fieldErrors: [
          {
            errorCode: "PROJECT_ARCHIVED",
            field: "projectId",
            message: "archive済みProjectのWBS baselineは変更できません。",
          },
        ],
      })
    );
    const page = useWbsPage();
    await page.initialize();

    await page.activateWbsBaseline(inactiveBaselineSummary);

    expect(page.baselineErrorMessages.value).toEqual([
      "archive済みProjectのWBS baselineは変更できません。",
    ]);
  });

  it("有効化の後は、押したボタンが残っていればそこへ、なければ直前のactive baselineのボタンへフォーカスを戻す", async () => {
    mocks.userStore.accountId = 1;
    const page = useWbsPage();
    await page.initialize();

    await page.activateWbsBaseline(inactiveBaselineSummary);

    // 単体テストのdocumentは常に要素を返すため、候補の先頭（押したボタン）へ戻したことだけを確かめる。
    expect(mocks.focusedControls).toEqual([
      buildBaselineActivateControlKey(inactiveBaselineSummary.baselineId),
    ]);
  });

  it("baseline更新409後の再取得で401になった場合は競合案内を残さない", async () => {
    mocks.userStore.accountId = 1;
    mocks.wbsApi.activateWbsBaseline.mockRejectedValue(
      new WbsApiError(409, {
        fieldErrors: [
          {
            errorCode: "WBS_BASELINE_VERSION_CONFLICT",
            field: "version",
            message: "更新されています。",
          },
        ],
      })
    );
    mocks.wbsApi.getWbsBaselines
      .mockResolvedValueOnce(structuredClone(baselineList))
      .mockRejectedValueOnce(new WbsApiError(401, null));
    const page = useWbsPage();
    await page.initialize();

    await page.activateWbsBaseline(inactiveBaselineSummary);

    expect(page.baselineErrorMessages.value).toEqual([]);
    expect(page.activatingBaselineId.value).toBeNull();
    expect(mocks.userStore.clearSession).toHaveBeenCalledOnce();
    expect(mocks.router.push).toHaveBeenCalledWith({ name: "Login" });
  });

  describe("contextを直接渡した場合", () => {
    /** Project管理権限を持つ利用者のcontextでbaseline操作を作る。 */
    const buildManagerBaselines = (overrides = {}) => {
      const context = buildWbsPageContext({
        canManageProject: computed(() => true),
        ...overrides,
      });
      const onActiveBaselineChanged = vi.fn();
      return {
        context,
        onActiveBaselineChanged,
        state: useWbsBaselines(context, { onActiveBaselineChanged }),
      };
    };

    it.each([
      ["ACTIVE・更新権限・Project管理権限あり", {}, true],
      ["Projectがarchive済み", { project: ref({ ...structuredClone(project), status: "ARCHIVED" }) }, false],
      ["TASK_UPDATEなし", { canEditWbs: computed(() => false) }, false],
      ["Project管理権限なし", { canManageProject: computed(() => false) }, false],
    ])("%sの場合のbaseline管理可否は%s", (_label, overrides, expected) => {
      const { state } = buildManagerBaselines(overrides);

      expect(state.canManageBaselines.value).toBe(expected);
    });

    it("active baselineがなければ詳細APIを呼ばず比較対象を空にする", async () => {
      mocks.wbsApi.getWbsBaselines.mockResolvedValue({
        projectId: 7,
        baselines: [{ ...baselineSummary, active: false }],
      });
      const { state } = buildManagerBaselines();

      await state.loadWbsBaselines();

      expect(mocks.wbsApi.getWbsBaseline).not.toHaveBeenCalled();
      expect(state.activeBaseline.value).toBeNull();
      expect(state.activeBaselineDetail.value).toBeNull();
      expect(state.baselineChangedRows.value).toHaveLength(3);
    });

    it("active baselineと現在計画の差分がある行だけを変更行にする", async () => {
      const { state } = buildManagerBaselines();

      await state.loadWbsBaselines();

      expect(state.activeBaseline.value?.baselineId).toBe(21);
      expect(state.baselineComparisonRows.value).toHaveLength(3);
      expect(state.baselineChangedRows.value.map((row) => row.sourceTaskId)).toEqual([2]);
    });

    it("すでにactiveなbaselineは有効化APIを呼ばない", async () => {
      const { state, onActiveBaselineChanged } = buildManagerBaselines();

      await state.activateWbsBaseline(baselineSummary);

      expect(mocks.wbsApi.activateWbsBaseline).not.toHaveBeenCalled();
      expect(onActiveBaselineChanged).not.toHaveBeenCalled();
    });

    it("作成APIの403は作成Dialog内、有効化APIの403はcardへ表示する", async () => {
      mocks.wbsApi.createWbsBaseline.mockRejectedValue(new WbsApiError(403, null));
      mocks.wbsApi.activateWbsBaseline.mockRejectedValue(new WbsApiError(403, null));
      const { state, onActiveBaselineChanged } = buildManagerBaselines();
      await state.loadWbsBaselines();
      state.openBaselineCreateDialog();

      await state.saveWbsBaseline({ name: "9月計画", description: "" });
      expect(state.baselineEditorErrorMessages.value).toEqual([
        DISPLAY_MESSAGES.wbs.baseline.forbidden,
      ]);
      expect(state.isBaselineCreateDialogOpen.value).toBe(true);

      await state.activateWbsBaseline(baselineList.baselines[1]);
      expect(state.baselineErrorMessages.value).toEqual([
        DISPLAY_MESSAGES.wbs.baseline.forbidden,
      ]);
      expect(onActiveBaselineChanged).not.toHaveBeenCalled();
    });

    it("作成APIの401はSession失効処理へ委ね、作成Dialogを閉じる関数を提供する", async () => {
      mocks.wbsApi.createWbsBaseline.mockRejectedValue(new WbsApiError(401, null));
      const { context, state } = buildManagerBaselines();
      state.openBaselineCreateDialog();

      await state.saveWbsBaseline({ name: "9月計画", description: "" });

      expect(context.handleUnauthorized).toHaveBeenCalledOnce();
      expect(state.baselineEditorErrorMessages.value).toEqual([]);
      // Dialogを閉じるのは統括のuseWbsPageの役目。閉じる関数が処理中でも閉じることだけを確かめる。
      state.discardBaselineDialogs();
      expect(state.isBaselineCreateDialogOpen.value).toBe(false);
    });

    it("作成成功後の一覧再取得が500でも作成成功を残し再読込案内を追加する", async () => {
      const { state, onActiveBaselineChanged } = buildManagerBaselines();
      state.openBaselineCreateDialog();
      mocks.wbsApi.getWbsBaselines.mockRejectedValue(new WbsApiError(500, null));

      await state.saveWbsBaseline({ name: "9月計画", description: "" });

      expect(onActiveBaselineChanged).toHaveBeenCalledOnce();
      expect(state.baselineSuccessMessage.value).toContain("を作成しました");
      expect(state.baselineErrorMessages.value).toEqual([
        DISPLAY_MESSAGES.wbs.baseline.reloadFailed,
      ]);
    });

    it("作成中は作成Dialogを閉じない", async () => {
      let resolveCreate;
      mocks.wbsApi.createWbsBaseline.mockReturnValueOnce(
        new Promise((resolve) => {
          resolveCreate = resolve;
        })
      );
      const { state } = buildManagerBaselines();
      state.openBaselineCreateDialog();

      const saving = state.saveWbsBaseline({ name: "9月計画", description: "" });
      state.closeBaselineCreateDialog();
      expect(state.isBaselineCreateDialogOpen.value).toBe(true);
      resolveCreate(structuredClone(baselineCreateResponse));
      await saving;

      expect(state.isBaselineCreateDialogOpen.value).toBe(false);
    });
  });
});
