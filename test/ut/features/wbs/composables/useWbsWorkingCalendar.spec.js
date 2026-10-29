import { beforeEach, describe, expect, it, vi } from "vitest";
import { computed, ref } from "vue";

import { WbsApiError } from "@/features/wbs/api/wbsApi";
import { useWbsPage } from "@/features/wbs/composables/useWbsPage";
import {
  useWbsWorkingCalendar,
  WORKING_CALENDAR_SUBMIT_CONTROL,
  buildWorkingDayEditControlKey,
} from "@/features/wbs/composables/useWbsWorkingCalendar";
import { buildWorkingCalendarTargetKey } from "@/features/wbs/utils/workingCalendar";
import { DISPLAY_MESSAGES } from "@/shared/constants/displayMessages";

import {
  buildWbsPageContext,
  project,
  mocks,
  workloadResponse,
  workingCalendarResponse,
  memberWorkingCalendarResponse,
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

describe("useWbsWorkingCalendar", () => {
  beforeEach(resetWbsPageMocks);

  it("初期表示でProject共通calendarを取得し通常memberには本人の対象だけを提示する", async () => {
    const page = useWbsPage();

    await page.initialize();

    expect(mocks.wbsApi.getWorkingCalendar).toHaveBeenCalledWith(
      7,
      page.workingCalendarDateRange.value.dateFrom,
      page.workingCalendarDateRange.value.dateTo,
      null
    );
    expect(page.workingCalendarTargetOptions.value).toEqual([
      { title: "Project共通", value: "PROJECT" },
      {
        title: "個人例外: 参加 二郎（MEMBER）",
        value: "MEMBER:2",
      },
    ]);
    expect(page.canEditSelectedWorkingCalendarTarget.value).toBe(false);
  });

  it("通常memberは本人の個人例外を登録しcalendarとworkload容量を再取得する", async () => {
    mocks.wbsApi.getWorkingCalendar
      .mockResolvedValueOnce(structuredClone(workingCalendarResponse))
      .mockResolvedValue(structuredClone(memberWorkingCalendarResponse));
    const page = useWbsPage();
    await page.initialize();

    await page.loadWorkingCalendar(
      page.workingCalendarDateRange.value,
      "MEMBER:2"
    );
    page.openWorkingDayEditor("2026-08-23");
    await page.saveWorkingDay({
      workDate: "2026-08-23",
      dayType: "WORKING_DAY",
      availableMinutes: 420,
    });

    expect(page.canEditSelectedWorkingCalendarTarget.value).toBe(true);
    expect(mocks.wbsApi.createMemberWorkingDay).toHaveBeenCalledWith(7, 2, {
      workDate: "2026-08-23",
      dayType: "WORKING_DAY",
      availableMinutes: 420,
    });
    expect(page.isWorkingDayEditorOpen.value).toBe(false);
    expect(page.workingCalendarSuccessMessage.value).toBe(
      "稼働日例外を登録しました。"
    );
    expect(mocks.wbsApi.getTaskWorkload).toHaveBeenCalledTimes(2);
  });

  it("SYSTEM_ADMINはProject共通例外をversion付きで更新しworkload容量を再取得する", async () => {
    mocks.roles.add("SYSTEM_ADMIN");
    const page = useWbsPage();
    await page.initialize();

    page.openWorkingDayEditor("2026-08-22");
    await page.saveWorkingDay({
      workDate: "2026-08-22",
      dayType: "WORKING_DAY",
      availableMinutes: 480,
    });

    expect(
      page.workingCalendarTargetOptions.value.map((option) => option.value)
    ).toEqual(["PROJECT", "MEMBER:1", "MEMBER:2"]);
    expect(mocks.wbsApi.updateProjectWorkingDay).toHaveBeenCalledWith(7, 11, {
      workDate: "2026-08-22",
      dayType: "WORKING_DAY",
      availableMinutes: 480,
      version: 3,
    });
    expect(mocks.wbsApi.getTaskWorkload).toHaveBeenCalledTimes(2);
  });

  it("不正な稼働日FormではAPIを呼ばず全理由をDialogへ表示する", async () => {
    mocks.roles.add("SYSTEM_ADMIN");
    const page = useWbsPage();
    await page.initialize();
    page.openWorkingDayEditor("2026-08-22");

    await page.saveWorkingDay({
      workDate: "2026-02-30",
      dayType: "HOLIDAY",
      availableMinutes: 60,
    });

    expect(mocks.wbsApi.updateProjectWorkingDay).not.toHaveBeenCalled();
    expect(page.workingCalendarEditorErrorMessages.value).toEqual([
      "設定日を入力してください。",
      "休日の稼働可能時間は0分にしてください。",
    ]);
    expect(page.isWorkingDayEditorOpen.value).toBe(true);
  });

  it("稼働日例外の409競合では古いDialogを閉じ最新calendarとworkloadを再取得する", async () => {
    mocks.roles.add("SYSTEM_ADMIN");
    mocks.wbsApi.updateProjectWorkingDay.mockRejectedValue(
      new WbsApiError(409, {
        fieldErrors: [
          {
            errorCode: "WORKING_DAY_VERSION_CONFLICT",
            field: "version",
            message: "更新されています。",
          },
        ],
      })
    );
    const page = useWbsPage();
    await page.initialize();
    page.openWorkingDayEditor("2026-08-22");

    await page.saveWorkingDay({
      workDate: "2026-08-22",
      dayType: "WORKING_DAY",
      availableMinutes: 480,
    });

    expect(page.isWorkingDayEditorOpen.value).toBe(false);
    // 画面は取り直し済みなので、Backendの「最新状態を取得してください」の後ろに取り直し済みの案内を添える。
    expect(page.workingCalendarErrorMessages.value).toEqual([
      "更新されています。",
      DISPLAY_MESSAGES.wbs.workingCalendar.conflictReloaded,
    ]);
    expect(mocks.wbsApi.getWorkingCalendar).toHaveBeenCalledTimes(2);
    expect(mocks.wbsApi.getTaskWorkload).toHaveBeenCalledTimes(2);
  });

  it("稼働日409後の再取得で401になった場合は競合案内を残さない", async () => {
    mocks.roles.add("SYSTEM_ADMIN");
    mocks.wbsApi.updateProjectWorkingDay.mockRejectedValue(
      new WbsApiError(409, {
        fieldErrors: [
          {
            errorCode: "WORKING_DAY_VERSION_CONFLICT",
            field: "version",
            message: "更新されています。",
          },
        ],
      })
    );
    mocks.wbsApi.getWorkingCalendar
      .mockResolvedValueOnce(structuredClone(workingCalendarResponse))
      .mockRejectedValueOnce(new WbsApiError(401, null));
    const page = useWbsPage();
    await page.initialize();
    page.openWorkingDayEditor("2026-08-22");

    await page.saveWorkingDay({
      workDate: "2026-08-22",
      dayType: "WORKING_DAY",
      availableMinutes: 480,
    });

    expect(page.workingCalendarErrorMessages.value).toEqual([]);
    expect(page.isWorkingDayEditorOpen.value).toBe(false);
    expect(mocks.userStore.clearSession).toHaveBeenCalledOnce();
    expect(mocks.router.push).toHaveBeenCalledWith({ name: "Login" });
  });

  it("並列workload再取得の401後にcalendar取得が完了しても競合案内を復元しない", async () => {
    let resolveCalendarReload;
    mocks.roles.add("SYSTEM_ADMIN");
    mocks.wbsApi.updateProjectWorkingDay.mockRejectedValue(
      new WbsApiError(409, {
        fieldErrors: [
          {
            errorCode: "WORKING_DAY_VERSION_CONFLICT",
            field: "version",
            message: "更新されています。",
          },
        ],
      })
    );
    mocks.wbsApi.getWorkingCalendar
      .mockResolvedValueOnce(structuredClone(workingCalendarResponse))
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveCalendarReload = resolve;
          })
      );
    mocks.wbsApi.getTaskWorkload
      .mockResolvedValueOnce(structuredClone(workloadResponse))
      .mockRejectedValueOnce(new WbsApiError(401, null));
    const page = useWbsPage();
    await page.initialize();
    page.openWorkingDayEditor("2026-08-22");

    const savePromise = page.saveWorkingDay({
      workDate: "2026-08-22",
      dayType: "WORKING_DAY",
      availableMinutes: 480,
    });
    await vi.waitFor(() =>
      expect(mocks.userStore.clearSession).toHaveBeenCalledOnce()
    );
    resolveCalendarReload(structuredClone(workingCalendarResponse));
    await savePromise;

    expect(page.workingCalendarErrorMessages.value).toEqual([]);
    expect(mocks.router.push).toHaveBeenCalledWith({ name: "Login" });
  });

  it("本人の個人例外を取得時点versionで削除しcalendarとworkloadを再取得する", async () => {
    mocks.wbsApi.getWorkingCalendar
      .mockResolvedValueOnce(structuredClone(workingCalendarResponse))
      .mockResolvedValue(structuredClone(memberWorkingCalendarResponse));
    const page = useWbsPage();
    await page.initialize();
    await page.loadWorkingCalendar(
      page.workingCalendarDateRange.value,
      "MEMBER:2"
    );

    page.requestWorkingDayDelete("2026-08-22");
    await page.confirmWorkingDayDelete();

    expect(mocks.wbsApi.deleteMemberWorkingDay).toHaveBeenCalledWith(
      7,
      2,
      21,
      4
    );
    expect(page.workingDayPendingDelete.value).toBeNull();
    expect(page.workingCalendarSuccessMessage.value).toBe(
      "稼働日例外を削除しました。"
    );
    expect(mocks.wbsApi.getTaskWorkload).toHaveBeenCalledTimes(2);
    // 削除ボタンは消えるので、同じ行の「登録・編集」へフォーカスを戻す。
    expect(mocks.focusedControls).toEqual([buildWorkingDayEditControlKey("2026-08-22")]);
  });

  describe("contextを直接渡した場合", () => {
    const range = { dateFrom: "2026-08-01", dateTo: "2026-08-31" };
    const ownMemberKey = buildWorkingCalendarTargetKey({ kind: "MEMBER", accountId: 2 });
    const otherMemberKey = buildWorkingCalendarTargetKey({ kind: "MEMBER", accountId: 1 });

    /** 既定はProject共通calendarを取得済みの通常member（accountId 2）。workload再取得はmockにする。 */
    const buildCalendar = async (contextOverrides = {}, targetKey = "PROJECT") => {
      const context = buildWbsPageContext(contextOverrides);
      const options = { reloadWorkload: vi.fn(async () => {}) };
      const state = useWbsWorkingCalendar(context, options);
      await state.loadWorkingCalendar(range, targetKey);
      return { context, options, state };
    };

    it.each([
      ["Project共通・Project管理権限あり", "PROJECT", { canManageProject: computed(() => true) }, true],
      ["Project共通・通常member", "PROJECT", {}, false],
      ["本人の個人例外・通常member", "__OWN__", {}, true],
      ["他memberの個人例外・Project管理権限あり", "__OTHER__", { canManageProject: computed(() => true) }, true],
      ["本人の個人例外・TASK_UPDATEなし", "__OWN__", { canEditWbs: computed(() => false) }, false],
      [
        "本人の個人例外・archive済みProject",
        "__OWN__",
        { project: ref({ ...structuredClone(project), status: "ARCHIVED" }) },
        false,
      ],
    ])("%s（対象key %s）で編集可否を判定する", async (_label, key, overrides, expected) => {
      const targetKey = key === "__OWN__" ? ownMemberKey : key === "__OTHER__" ? otherMemberKey : key;
      const { state } = await buildCalendar(overrides, targetKey);

      expect(state.workingCalendarSelectedTargetKey.value).toBe(targetKey);
      expect(state.canEditSelectedWorkingCalendarTarget.value).toBe(expected);
    });

    it("無効化された参加者の個人例外は、Project管理権限があっても参照だけにして理由を出す", async () => {
      const inactiveProject = structuredClone(project);
      inactiveProject.members[0].accountStatus = "DISABLED";
      const { state } = await buildCalendar(
        { canManageProject: computed(() => true), project: ref(inactiveProject) },
        otherMemberKey
      );

      expect(state.canEditSelectedWorkingCalendarTarget.value).toBe(false);
      expect(state.workingCalendarReadOnlyMessage.value).toBe(
        DISPLAY_MESSAGES.wbs.workingCalendar.inactiveMemberReadOnly
      );
    });

    it("「表示」を押した後は「表示」へフォーカスを戻す", async () => {
      const { state } = await buildCalendar();
      mocks.focusedControls.length = 0;

      await state.submitWorkingCalendar(range, "PROJECT");

      expect(mocks.focusedControls).toEqual([WORKING_CALENDAR_SUBMIT_CONTROL]);
    });

    it("archive済みProjectでは、権限があってもarchive済みの案内を出す", async () => {
      const { state } = await buildCalendar({
        canManageProject: computed(() => true),
        project: ref({ ...structuredClone(project), status: "ARCHIVED" }),
      });

      expect(state.canEditSelectedWorkingCalendarTarget.value).toBe(false);
      expect(state.workingCalendarReadOnlyMessage.value).toBe(
        DISPLAY_MESSAGES.wbs.workingCalendar.archivedReadOnly
      );
    });

    it("変更できる対象では参照専用の案内を出さず、権限がなければ権限の案内を出す", async () => {
      const editable = await buildCalendar({ canManageProject: computed(() => true) });
      const readOnly = await buildCalendar();

      expect(editable.state.workingCalendarReadOnlyMessage.value).toBeNull();
      expect(readOnly.state.workingCalendarReadOnlyMessage.value).toBe(
        DISPLAY_MESSAGES.wbs.workingCalendar.readOnly
      );
    });

    it("同じ日付の例外の重複（409）では、取り直しても取り直し済みの案内を添えない", async () => {
      mocks.wbsApi.createProjectWorkingDay.mockRejectedValue(
        new WbsApiError(409, {
          fieldErrors: [
            {
              errorCode: "WORKING_DAY_ALREADY_EXISTS",
              field: "workDate",
              message: "同じ日付に稼働日設定が既に存在します。",
            },
          ],
        })
      );
      const { state } = await buildCalendar({ canManageProject: computed(() => true) });
      state.openWorkingDayEditor("2026-08-23");

      await state.saveWorkingDay({ workDate: "2026-08-23", dayType: "HOLIDAY", availableMinutes: 0 });

      expect(state.workingCalendarErrorMessages.value).toEqual([
        "同じ日付に稼働日設定が既に存在します。",
      ]);
    });

    it("削除のversion競合（409）で取り直せたときは取り直し済みの案内を添え、同じ行へフォーカスを戻す", async () => {
      mocks.wbsApi.deleteProjectWorkingDay.mockRejectedValue(
        new WbsApiError(409, {
          fieldErrors: [
            {
              errorCode: "WORKING_DAY_VERSION_CONFLICT",
              field: "version",
              message: "別の操作で稼働日設定が変更されました。最新状態を取得してください。",
            },
          ],
        })
      );
      const { state } = await buildCalendar({ canManageProject: computed(() => true) });
      state.requestWorkingDayDelete("2026-08-22");

      await state.confirmWorkingDayDelete();

      expect(state.workingCalendarErrorMessages.value).toEqual([
        "別の操作で稼働日設定が変更されました。最新状態を取得してください。",
        DISPLAY_MESSAGES.wbs.workingCalendar.conflictReloaded,
      ]);
      expect(mocks.focusedControls).toEqual([buildWorkingDayEditControlKey("2026-08-22")]);
    });

    it("通常memberは他memberの個人例外を表示対象に選べずAPIを呼ばない", async () => {
      const { state } = await buildCalendar();
      mocks.wbsApi.getWorkingCalendar.mockClear();

      await state.loadWorkingCalendar(range, otherMemberKey);

      expect(mocks.wbsApi.getWorkingCalendar).not.toHaveBeenCalled();
      expect(state.workingCalendarErrorMessages.value).toEqual([
        "calendarの表示対象を選択してください。",
      ]);
      expect(state.workingCalendarSelectedTargetKey.value).toBe("PROJECT");
    });

    it("対象切替の取得中は直前対象のcalendarを破棄して例外を操作させない", async () => {
      const { state } = await buildCalendar();
      let resolveCalendar;
      mocks.wbsApi.getWorkingCalendar.mockReturnValueOnce(
        new Promise((resolve) => {
          resolveCalendar = resolve;
        })
      );

      const loading = state.loadWorkingCalendar(range, ownMemberKey);
      expect(state.workingCalendar.value).toBeNull();
      state.requestWorkingDayDelete("2026-08-22");
      expect(state.workingDayPendingDelete.value).toBeNull();
      resolveCalendar(structuredClone(memberWorkingCalendarResponse));
      await loading;

      expect(mocks.wbsApi.getWorkingCalendar).toHaveBeenLastCalledWith(7, "2026-08-01", "2026-08-31", 2);
      expect(state.workingCalendar.value).toEqual(memberWorkingCalendarResponse);
    });

    it("選択階層に例外がない日付は削除確認を開かない", async () => {
      const { state } = await buildCalendar({ canManageProject: computed(() => true) });

      state.requestWorkingDayDelete("2026-08-23");

      expect(state.workingDayPendingDelete.value).toBeNull();
      expect(state.workingCalendarErrorMessages.value).toEqual([
        "削除対象の稼働日例外が見つかりません。",
      ]);
    });

    it("削除APIの403では確認対象を残し権限不足を表示する", async () => {
      mocks.wbsApi.deleteProjectWorkingDay.mockRejectedValue(new WbsApiError(403, null));
      const { options, state } = await buildCalendar({ canManageProject: computed(() => true) });
      state.requestWorkingDayDelete("2026-08-22");

      await state.confirmWorkingDayDelete();

      expect(state.workingDayPendingDelete.value?.workingDayId).toBe(11);
      expect(state.workingCalendarErrorMessages.value).toEqual([
        DISPLAY_MESSAGES.wbs.workingCalendar.deleteForbidden,
      ]);
      expect(options.reloadWorkload).not.toHaveBeenCalled();
    });

    it("競合後のcalendar再取得が500なら競合理由に再読込案内を追加しworkloadも再取得する", async () => {
      mocks.wbsApi.deleteProjectWorkingDay.mockRejectedValue(new WbsApiError(409, null));
      const { options, state } = await buildCalendar({ canManageProject: computed(() => true) });
      state.requestWorkingDayDelete("2026-08-22");
      mocks.wbsApi.getWorkingCalendar.mockRejectedValue(new WbsApiError(500, null));

      await state.confirmWorkingDayDelete();

      expect(state.workingDayPendingDelete.value).toBeNull();
      expect(state.workingCalendarErrorMessages.value).toEqual([
        DISPLAY_MESSAGES.wbs.workingCalendar.stale,
        DISPLAY_MESSAGES.wbs.workingCalendar.reloadFailed,
      ]);
      expect(options.reloadWorkload).toHaveBeenCalledOnce();
    });

    it("保存中は編集Dialogを閉じず、保存確定後に閉じる", async () => {
      let resolveSave;
      mocks.wbsApi.updateProjectWorkingDay.mockReturnValueOnce(
        new Promise((resolve) => {
          resolveSave = resolve;
        })
      );
      const { state } = await buildCalendar({ canManageProject: computed(() => true) });
      state.openWorkingDayEditor("2026-08-22");

      const saving = state.saveWorkingDay({
        workDate: "2026-08-22",
        dayType: "WORKING_DAY",
        availableMinutes: 240,
      });
      state.closeWorkingDayEditor();
      expect(state.isWorkingDayEditorOpen.value).toBe(true);
      resolveSave(structuredClone(workingCalendarResponse));
      await saving;

      expect(state.isWorkingDayEditorOpen.value).toBe(false);
      expect(state.workingCalendarSuccessMessage.value).toBe("稼働日例外を更新しました。");
    });

    it("削除確認dialogを閉じたときだけ確認対象を破棄する", async () => {
      const { state } = await buildCalendar({ canManageProject: computed(() => true) });
      state.requestWorkingDayDelete("2026-08-22");

      state.handleWorkingDayDeleteDialogVisibility(true);
      expect(state.workingDayPendingDelete.value).not.toBeNull();
      state.handleWorkingDayDeleteDialogVisibility(false);
      expect(state.workingDayPendingDelete.value).toBeNull();
    });
  });
});
