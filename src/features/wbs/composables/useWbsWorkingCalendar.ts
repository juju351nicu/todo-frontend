import { computed, ref } from "vue";

import { useUserStore } from "@/features/auth/stores/user";
import {
  formatProjectMemberLabel,
  isActiveProjectMember,
  resolveProjectMemberDisplayName,
} from "@/features/project/utils/projectMember";
import WbsApi, { WbsApiError } from "@/features/wbs/api/wbsApi";
import type { WbsPageContext } from "@/features/wbs/composables/wbsPageContext";
import type {
  WorkingCalendarDateRange,
  WorkingCalendarDay,
  WorkingCalendarResponse,
  WorkingCalendarTargetOption,
  WorkingDayForm,
  WorkingDayOverride,
} from "@/features/wbs/types/wbs";
import {
  resolveWbsErrorMessages,
  resolveWbsStandardErrorMessages,
  WBS_RECOVERY_PRIORITY_STATUSES,
} from "@/features/wbs/utils/apiErrors";
import {
  buildDefaultWorkingCalendarDateRange,
  buildWorkingCalendarTargetKey,
  buildWorkingDayCreateRequest,
  buildWorkingDayUpdateRequest,
  getWorkingDayOverride,
  parseWorkingCalendarTargetKey,
  validateWorkingCalendarDateRange,
  validateWorkingDayForm,
} from "@/features/wbs/utils/workingCalendar";
import { DISPLAY_MESSAGES } from "@/shared/constants/displayMessages";
import { hasApiFieldError } from "@/shared/utils/apiError";
import { createDataAttributeSelector, focusFirstEnabledElement } from "@/shared/utils/focus";

/**
 * 稼働日calendarの各行の「登録・編集」ボタンに付ける`data-working-calendar-control`属性の値を作る。
 * 削除すると同じ行の削除ボタンが消えてフォーカスがbodyへ外れるため、削除の後はこのボタンへ戻す。
 *
 * @param workDate 行の日付（yyyy-MM-dd）
 * @returns 属性の値
 */
export const workingDayEditControlKey = (workDate: string): string =>
  `day:${workDate}:edit`;

/**
 * 稼働日calendar cardの「表示」ボタンに付ける`data-working-calendar-control`属性の値。
 * 取得中は「表示」がdisabledになりフォーカスがbodyへ外れるため、利用者が押した後はここへ戻す。
 */
export const WORKING_CALENDAR_SUBMIT_CONTROL = "submit";

/** `data-working-calendar-control`属性の値から、その要素を探すselectorを作る。 */
const buildWorkingCalendarControlSelector = createDataAttributeSelector("data-working-calendar-control");

/**
 * Backendの文言が「最新状態を取得してください。」で終わる409のerror code
 * （`messages.properties`の`error.wbs.conflict.working-day-version`）。
 * 画面は409の後に必ずcalendarを取り直すため、取り直せたときだけ取り直し済みの案内を添える。
 * 同じ日付の例外の重複（`WORKING_DAY_ALREADY_EXISTS`）は文言が再取得を求めないので添えない。
 */
const RELOAD_GUIDANCE_ERROR_CODE = "WORKING_DAY_VERSION_CONFLICT";

/** `useWbsWorkingCalendar`が画面の他領域へ委ねる操作。 */
export interface UseWbsWorkingCalendarOptions {
  /**
   * 稼働日例外の変更・競合後に、担当者別workloadを現在の集計期間で再取得する。
   * workloadの稼働可能時間・残容量・過配賦はcalendar例外から算出されるため。
   */
  readonly reloadWorkload: () => Promise<void>;
}

/**
 * WBS画面の稼働日calendar（Project共通・member個人の稼働日例外）の表示と登録・更新・削除を管理する。
 *
 * - 呼び出すAPI: `WbsApi.getWorkingCalendar`（既定値・Project例外・member例外を解決済みの全日付）、
 *   Project共通例外は`create`／`update`／`deleteProjectWorkingDay`、個人例外は`create`／`update`／`deleteMemberWorkingDay`。
 *   更新・削除は取得時点versionを送る。
 * - 表示対象: Project管理権限（SYSTEM_ADMIN・OWNER・MANAGER）があればProject共通と全memberの個人例外、
 *   それ以外はProject共通と本人の個人例外だけ。
 * - 変更権限: ProjectがACTIVEでTASK_UPDATEを持ち、Project共通はProject管理権限、個人例外はProject管理権限または本人。
 *   個人例外は、対象の参加者がACTIVEの場合だけ変更できる（Backendは無効化・ロック中の参加者の個人例外を400にする）。
 * - 変更・404・409の後はcalendar全体と`reloadWorkload`でworkloadを再取得する（Backendの変更Responseは対象日だけのため）。
 * - 401では`context.handleUnauthorized`へ委ね、編集Dialogと削除確認は統括の`useWbsPage`が`discardWorkingDayDialogs`で閉じる。
 *
 * @param context Project ID、Project member、権限、Session失効処理を提供する画面共通context
 * @param options calendar変更後のworkload再取得
 */
export const useWbsWorkingCalendar = (
  context: WbsPageContext,
  options: UseWbsWorkingCalendarOptions
) => {
  const userStore = useUserStore();

  /** 最後に取得成功したcalendar。対象切替中と初期表示の取得失敗時はnull。 */
  const workingCalendar = ref<WorkingCalendarResponse | null>(null);
  /** 最後に取得を開始した表示期間。初期値は`buildDefaultWorkingCalendarDateRange`の期間。 */
  const workingCalendarDateRange = ref<WorkingCalendarDateRange>(
    buildDefaultWorkingCalendarDateRange()
  );
  const workingCalendarEditorErrorMessages = ref<string[]>([]);
  const workingCalendarErrorMessages = ref<string[]>([]);
  /** 表示対象のkey。`"PROJECT"`または`buildWorkingCalendarTargetKey`で作るmember個人のkey。 */
  const workingCalendarSelectedTargetKey = ref("PROJECT");
  const workingCalendarSuccessMessage = ref("");
  /** 編集Dialogで編集中の日付。取得時点の例外とversionを複製して保持する。 */
  const workingDayEditingDay = ref<WorkingCalendarDay | null>(null);
  /** 削除確認中の稼働日例外と取得時点version。確認Dialogの開閉もこの値の有無で決まる。 */
  const workingDayPendingDelete = ref<WorkingDayOverride | null>(null);
  const isDeletingWorkingDay = ref(false);
  const isLoadingWorkingCalendar = ref(false);
  const isSavingWorkingDay = ref(false);
  const isWorkingDayEditorOpen = ref(false);

  const workingCalendarTargetOptions = computed<
    WorkingCalendarTargetOption[]
  >(() => {
    const targetOptions: WorkingCalendarTargetOption[] = [
      { title: "Project共通", value: "PROJECT" },
    ];
    const members = (context.project.value?.members ?? []).filter(
      (member) =>
        context.canManageProject.value ||
        member.accountId === userStore.accountId
    );
    return targetOptions.concat(
      members.map((member) => ({
        title: `個人例外: ${formatProjectMemberLabel(member)}`,
        value: buildWorkingCalendarTargetKey({
          kind: "MEMBER",
          accountId: member.accountId,
        }),
      }))
    );
  });
  /** 表示対象keyを解析した結果。keyが不正な場合はnull。 */
  const selectedWorkingCalendarTarget = computed(() =>
    parseWorkingCalendarTargetKey(workingCalendarSelectedTargetKey.value)
  );
  /** 個人例外を表示している場合の参加者名。稼働日例外Dialogの説明に使う。Project共通ならnull。 */
  const selectedWorkingCalendarTargetDisplayName = computed(() => {
    const target = selectedWorkingCalendarTarget.value;
    return target?.kind === "MEMBER"
      ? resolveProjectMemberDisplayName(
          context.project.value?.members ?? [],
          target.accountId
        )
      : null;
  });
  /**
   * 個人例外を表示していて、その参加者がACTIVEでない（無効化・ロック中、またはProjectから外れた）場合はtrue。
   * 表示はできるが、Backendは個人例外の登録・更新を`INVALID_WORKING_CALENDAR`（400）にするため、変更の操作を出さない。
   */
  const isSelectedTargetInactiveMember = computed(() => {
    const target = selectedWorkingCalendarTarget.value;
    if (target?.kind !== "MEMBER") {
      return false;
    }
    const member = context.project.value?.members.find(
      (candidate) => candidate.accountId === target.accountId
    );
    return member === undefined || !isActiveProjectMember(member);
  });
  /** 表示対象が自分の権限で変更できるか（Backendの`WorkingCalendarAuthorizationLogic`と同じ規則）。 */
  const hasWorkingCalendarTargetPermission = computed(() => {
    const target = selectedWorkingCalendarTarget.value;
    if (
      !context.canEditWbs.value ||
      context.project.value?.status !== "ACTIVE" ||
      target === null
    ) {
      return false;
    }
    return target.kind === "PROJECT"
      ? context.canManageProject.value
      : context.canManageProject.value ||
          target.accountId === userStore.accountId;
  });
  const canEditSelectedWorkingCalendarTarget = computed(
    () =>
      hasWorkingCalendarTargetPermission.value &&
      !isSelectedTargetInactiveMember.value
  );
  /**
   * 変更できない理由の案内。変更できる場合はnull。
   * archive済みProject、参加者が無効、権限がない、の順に、利用者が直せない理由から示す
   * （archive済みで権限の案内を出すと、OWNERにも権限が足りないように読めるため）。
   */
  const workingCalendarReadOnlyMessage = computed(() => {
    if (canEditSelectedWorkingCalendarTarget.value) {
      return null;
    }
    if (
      context.project.value !== null &&
      context.project.value.status !== "ACTIVE"
    ) {
      return DISPLAY_MESSAGES.wbs.workingCalendar.archivedReadOnly;
    }
    return hasWorkingCalendarTargetPermission.value
      ? DISPLAY_MESSAGES.wbs.workingCalendar.inactiveMemberReadOnly
      : DISPLAY_MESSAGES.wbs.workingCalendar.readOnly;
  });
  const isWorkingCalendarMutating = computed(
    () => isSavingWorkingDay.value || isDeletingWorkingDay.value
  );

  /**
   * 指定期間・対象の稼働日calendarを検証・取得し、既定値を含む確定表示へ反映する。
   * 取得中の再実行、期間不正、表示できない対象ではAPIを呼ばない。
   *
   * @param dateRange yyyy-MM-dd形式の表示開始日・終了日
   * @param targetKey `workingCalendarTargetOptions`に含まれる表示対象key
   */
  const loadWorkingCalendar = async (
    dateRange: WorkingCalendarDateRange,
    targetKey: string
  ): Promise<void> => {
    const projectId = context.projectId.value;
    if (projectId === null || isLoadingWorkingCalendar.value) {
      return;
    }
    const validationMessages = validateWorkingCalendarDateRange(dateRange);
    const target = parseWorkingCalendarTargetKey(targetKey);
    if (
      target === null ||
      !workingCalendarTargetOptions.value.some(
        (option) => option.value === targetKey
      )
    ) {
      validationMessages.push("calendarの表示対象を選択してください。");
    }
    if (validationMessages.length > 0 || target === null) {
      workingCalendarErrorMessages.value = validationMessages;
      return;
    }

    isLoadingWorkingCalendar.value = true;
    workingCalendarErrorMessages.value = [];
    workingCalendarSelectedTargetKey.value = targetKey;
    workingCalendarDateRange.value = { ...dateRange };
    // 対象切替中に直前対象の例外へ更新・削除操作を行わせない。
    workingCalendar.value = null;
    try {
      workingCalendar.value = await WbsApi.getWorkingCalendar(
        projectId,
        dateRange.dateFrom,
        dateRange.dateTo,
        target.accountId
      );
    } catch (error: unknown) {
      await handleWorkingCalendarReadError(error);
    } finally {
      isLoadingWorkingCalendar.value = false;
    }
  };

  /** 画面の再読込時に、利用者が最後に指定した期間・対象でcalendarを取得する。 */
  const loadCurrentWorkingCalendar = (): Promise<void> =>
    loadWorkingCalendar(
      workingCalendarDateRange.value,
      workingCalendarSelectedTargetKey.value
    );

  /** calendar参照APIの失敗を検索欄の案内またはSession失効処理へ変換する。 */
  const handleWorkingCalendarReadError = async (error: unknown): Promise<void> => {
    const result = resolveWbsStandardErrorMessages(error, {
      forbidden: DISPLAY_MESSAGES.wbs.workingCalendar.readForbidden,
      notFound: DISPLAY_MESSAGES.wbs.projectNotFound,
      failed: DISPLAY_MESSAGES.wbs.workingCalendar.loadFailed,
    });
    if (result.type === "unauthorized") {
      await context.handleUnauthorized();
      return;
    }
    workingCalendarErrorMessages.value = result.messages;
  };

  /**
   * 表示中calendarの日付を選択し、現在の有効値または保存済み例外で編集Dialogを開く。
   *
   * @param workDate 編集するyyyy-MM-dd形式の日付
   */
  const openWorkingDayEditor = (workDate: string): void => {
    workingCalendarEditorErrorMessages.value = [];
    workingCalendarSuccessMessage.value = "";
    if (!canEditSelectedWorkingCalendarTarget.value) {
      workingCalendarErrorMessages.value = [
        "このcalendar設定を更新する権限がありません。",
      ];
      return;
    }
    const day = workingCalendar.value?.days.find(
      (candidate) => candidate.workDate === workDate
    );
    if (day === undefined) {
      workingCalendarErrorMessages.value = [
        "編集対象のcalendar日付が見つかりません。",
      ];
      return;
    }
    workingDayEditingDay.value = {
      ...day,
      projectOverride:
        day.projectOverride === null ? null : { ...day.projectOverride },
      memberOverride:
        day.memberOverride === null ? null : { ...day.memberOverride },
    };
    isWorkingDayEditorOpen.value = true;
  };

  /** 保存中でなければ未確定の稼働日例外入力を破棄してDialogを閉じる。 */
  const closeWorkingDayEditor = (): void => {
    if (!isSavingWorkingDay.value) {
      closeWorkingDayEditorAfterOperation();
    }
  };

  /** 保存確定、競合、Session失効時に処理中状態に依存せず古いversionを破棄する。 */
  const closeWorkingDayEditorAfterOperation = (): void => {
    isWorkingDayEditorOpen.value = false;
    workingDayEditingDay.value = null;
    workingCalendarEditorErrorMessages.value = [];
  };

  /**
   * 稼働日例外Formを検証し、選択中のProject共通・member固有階層の登録または更新へ振り分ける。
   * Backendの変更Responseは対象日だけなので、保存後はcalendar全体と容量計算済みworkloadを再取得する。
   *
   * @param form 設定日、種別、分単位稼働可能時間を含む未検証入力
   */
  const saveWorkingDay = async (form: WorkingDayForm): Promise<void> => {
    const projectId = context.projectId.value;
    const target = selectedWorkingCalendarTarget.value;
    const day = workingDayEditingDay.value;
    if (
      isSavingWorkingDay.value ||
      projectId === null ||
      target === null ||
      day === null
    ) {
      return;
    }
    if (!canEditSelectedWorkingCalendarTarget.value) {
      workingCalendarEditorErrorMessages.value = [
        "このcalendar設定を更新する権限がありません。",
      ];
      return;
    }
    const validationMessages = validateWorkingDayForm(form);
    if (validationMessages.length > 0) {
      workingCalendarEditorErrorMessages.value = validationMessages;
      return;
    }
    const currentOverride = getWorkingDayOverride(day, target);

    isSavingWorkingDay.value = true;
    workingCalendarEditorErrorMessages.value = [];
    workingCalendarErrorMessages.value = [];
    workingCalendarSuccessMessage.value = "";
    try {
      if (target.kind === "PROJECT") {
        if (currentOverride === null) {
          await WbsApi.createProjectWorkingDay(
            projectId,
            buildWorkingDayCreateRequest(form)
          );
        } else {
          await WbsApi.updateProjectWorkingDay(
            projectId,
            currentOverride.workingDayId,
            buildWorkingDayUpdateRequest(form, currentOverride.version)
          );
        }
      } else if (currentOverride === null) {
        await WbsApi.createMemberWorkingDay(
          projectId,
          target.accountId,
          buildWorkingDayCreateRequest(form)
        );
      } else {
        await WbsApi.updateMemberWorkingDay(
          projectId,
          target.accountId,
          currentOverride.workingDayId,
          buildWorkingDayUpdateRequest(form, currentOverride.version)
        );
      }
      closeWorkingDayEditorAfterOperation();
      workingCalendarSuccessMessage.value =
        currentOverride === null
          ? "稼働日例外を登録しました。"
          : "稼働日例外を更新しました。";
      await reloadWorkingCalendarAndWorkload();
    } catch (error: unknown) {
      await handleWorkingDayMutationError(error);
    } finally {
      isSavingWorkingDay.value = false;
    }
  };

  /** 稼働日例外登録・更新APIのstatusを入力案内、競合再取得またはSession動作へ変換する。 */
  const handleWorkingDayMutationError = async (
    error: unknown
  ): Promise<void> => {
    if (!(error instanceof WbsApiError)) {
      workingCalendarEditorErrorMessages.value = [
        DISPLAY_MESSAGES.common.connectionFailed,
      ];
      return;
    }
    if (error.status === 401) {
      await context.handleUnauthorized();
      return;
    }
    if (error.status === 403) {
      workingCalendarEditorErrorMessages.value = [
        DISPLAY_MESSAGES.wbs.workingCalendar.updateForbidden,
      ];
      return;
    }
    if (error.status === 404 || error.status === 409) {
      closeWorkingDayEditorAfterOperation();
      workingDayPendingDelete.value = null;
      workingCalendarErrorMessages.value = resolveWbsErrorMessages(
        error,
        error.status === 409
          ? DISPLAY_MESSAGES.wbs.workingCalendar.conflict
          : DISPLAY_MESSAGES.wbs.workingCalendar.resourceNotFound
      );
      await reloadAfterStaleOperation(error);
      return;
    }
    workingCalendarEditorErrorMessages.value = resolveWbsErrorMessages(
      error,
      DISPLAY_MESSAGES.wbs.workingCalendar.saveFailed
    );
  };

  /**
   * 表示中の選択階層から削除対象と取得時点versionを確定して確認Dialogを開く。
   *
   * @param workDate 削除する例外のyyyy-MM-dd形式の日付
   */
  const requestWorkingDayDelete = (workDate: string): void => {
    workingCalendarErrorMessages.value = [];
    workingCalendarSuccessMessage.value = "";
    const target = selectedWorkingCalendarTarget.value;
    const day = workingCalendar.value?.days.find(
      (candidate) => candidate.workDate === workDate
    );
    const override =
      target === null || day === undefined
        ? null
        : getWorkingDayOverride(day, target);
    if (override === null) {
      workingCalendarErrorMessages.value = [
        "削除対象の稼働日例外が見つかりません。",
      ];
      return;
    }
    if (!canEditSelectedWorkingCalendarTarget.value) {
      workingCalendarErrorMessages.value = [
        "このcalendar設定を削除する権限がありません。",
      ];
      return;
    }
    workingDayPendingDelete.value = { ...override };
  };

  /** 削除中でなければ稼働日例外の確認対象を破棄する。 */
  const cancelWorkingDayDelete = (): void => {
    if (!isDeletingWorkingDay.value) {
      workingDayPendingDelete.value = null;
    }
  };

  /** 選択階層の稼働日例外を取得時点versionで削除し、calendar全体とworkloadを再取得する。 */
  const confirmWorkingDayDelete = async (): Promise<void> => {
    const projectId = context.projectId.value;
    const target = selectedWorkingCalendarTarget.value;
    const override = workingDayPendingDelete.value;
    if (
      projectId === null ||
      target === null ||
      override === null ||
      isDeletingWorkingDay.value
    ) {
      return;
    }
    if (!canEditSelectedWorkingCalendarTarget.value) {
      workingCalendarErrorMessages.value = [
        "このcalendar設定を削除する権限がありません。",
      ];
      return;
    }

    isDeletingWorkingDay.value = true;
    workingCalendarErrorMessages.value = [];
    workingCalendarSuccessMessage.value = "";
    // 削除後は削除ボタンが消えるため、成功・失敗にかかわらず同じ行の「登録・編集」へフォーカスを戻す。
    const editControl = buildWorkingCalendarControlSelector(
      workingDayEditControlKey(override.workDate)
    );
    try {
      if (target.kind === "PROJECT") {
        await WbsApi.deleteProjectWorkingDay(
          projectId,
          override.workingDayId,
          override.version
        );
      } else {
        await WbsApi.deleteMemberWorkingDay(
          projectId,
          target.accountId,
          override.workingDayId,
          override.version
        );
      }
      workingDayPendingDelete.value = null;
      workingCalendarSuccessMessage.value = "稼働日例外を削除しました。";
      await reloadWorkingCalendarAndWorkload();
    } catch (error: unknown) {
      await handleWorkingDayDeleteError(error);
    } finally {
      isDeletingWorkingDay.value = false;
    }
    if (!context.isSessionInvalidated()) {
      await focusFirstEnabledElement([editControl]);
    }
  };

  /** 稼働日例外削除APIのstatusを競合再取得、認可案内またはSession動作へ変換する。 */
  const handleWorkingDayDeleteError = async (
    error: unknown
  ): Promise<void> => {
    if (!(error instanceof WbsApiError)) {
      workingCalendarErrorMessages.value = [
        DISPLAY_MESSAGES.common.connectionFailed,
      ];
      return;
    }
    if (error.status === 401) {
      await context.handleUnauthorized();
      return;
    }
    if (error.status === 403) {
      workingCalendarErrorMessages.value = [
        DISPLAY_MESSAGES.wbs.workingCalendar.deleteForbidden,
      ];
      return;
    }
    if (error.status === 404 || error.status === 409) {
      workingDayPendingDelete.value = null;
      workingCalendarErrorMessages.value = resolveWbsErrorMessages(
        error,
        DISPLAY_MESSAGES.wbs.workingCalendar.stale
      );
      await reloadAfterStaleOperation(error);
      return;
    }
    workingCalendarErrorMessages.value = [
      DISPLAY_MESSAGES.wbs.workingCalendar.deleteFailed,
    ];
  };

  /**
   * 「表示」を押したときの処理。calendarを取得してから「表示」へフォーカスを戻す。
   * 初期表示ではフォーカスを動かさないよう、利用者の操作だけをこの関数で受ける。
   *
   * @param dateRange yyyy-MM-dd形式の表示開始日・終了日
   * @param targetKey `workingCalendarTargetOptions`に含まれる表示対象key
   */
  const submitWorkingCalendar = async (
    dateRange: WorkingCalendarDateRange,
    targetKey: string
  ): Promise<void> => {
    await loadWorkingCalendar(dateRange, targetKey);
    if (!context.isSessionInvalidated()) {
      await focusFirstEnabledElement([
        buildWorkingCalendarControlSelector(WORKING_CALENDAR_SUBMIT_CONTROL),
      ]);
    }
  };

  /**
   * 現在の期間・対象でcalendarを再取得し、古い例外IDとversionを残さない。
   * 再取得の前に表示していた操作結果（競合理由等）は、再取得後も残す。
   *
   * @returns 取り直せた場合はtrue。対象が不正、または取得に失敗した場合はfalse
   */
  const reloadWorkingCalendar = async (): Promise<boolean> => {
    const messagesBeforeReload = [...workingCalendarErrorMessages.value];
    const projectId = context.projectId.value;
    const target = selectedWorkingCalendarTarget.value;
    if (projectId === null || target === null) {
      workingCalendarErrorMessages.value = [
        ...messagesBeforeReload,
        DISPLAY_MESSAGES.wbs.workingCalendar.reloadFailed,
      ];
      return false;
    }
    try {
      workingCalendar.value = await WbsApi.getWorkingCalendar(
        projectId,
        workingCalendarDateRange.value.dateFrom,
        workingCalendarDateRange.value.dateTo,
        target.accountId
      );
      // 並行するworkload再取得が401でSessionを破棄した後は、Login遷移前の画面へ競合理由を戻さない。
      if (!context.isSessionInvalidated()) {
        workingCalendarErrorMessages.value = messagesBeforeReload;
      }
      return true;
    } catch (refreshError: unknown) {
      if (
        refreshError instanceof WbsApiError &&
        WBS_RECOVERY_PRIORITY_STATUSES.has(refreshError.status)
      ) {
        // Session・permission・公開範囲の変化は、操作時点の競合理由より優先する。
        await handleWorkingCalendarReadError(refreshError);
        return false;
      }
      workingCalendarErrorMessages.value = [
        ...messagesBeforeReload,
        DISPLAY_MESSAGES.wbs.workingCalendar.reloadFailed,
      ];
      return false;
    }
  };

  /**
   * calendar変更後に有効な稼働可能時間とworkload容量を同じBackend状態へ揃える。
   *
   * workloadはcalendar例外から稼働可能時間を算出するため、calendarだけを再取得すると
   * 稼働可能時間・残容量・過配賦表示が次回の手動集計まで古い値になる。
   */
  const reloadWorkingCalendarAndWorkload = async (): Promise<boolean> => {
    const [calendarReloaded] = await Promise.all([
      reloadWorkingCalendar(),
      options.reloadWorkload(),
    ]);
    return calendarReloaded;
  };

  /**
   * 404・409の後にcalendarとworkloadを取り直す。
   * version競合（`RELOAD_GUIDANCE_ERROR_CODE`）で取り直せたときは、Backendの「最新状態を取得してください。」の後ろに、
   * 画面側で取り直し済みであることの案内を添える（Project設定・Project Templateの409と同じ書き方）。
   *
   * @param error 変更・削除APIが返した404または409
   */
  const reloadAfterStaleOperation = async (error: WbsApiError): Promise<void> => {
    const reloaded = await reloadWorkingCalendarAndWorkload();
    if (
      reloaded &&
      !context.isSessionInvalidated() &&
      hasApiFieldError(error.errorResponse, RELOAD_GUIDANCE_ERROR_CODE)
    ) {
      workingCalendarErrorMessages.value = [
        ...workingCalendarErrorMessages.value,
        DISPLAY_MESSAGES.wbs.workingCalendar.conflictReloaded,
      ];
    }
  };

  /**
   * 編集Dialogと削除確認を処理中状態に依存せず閉じ、古い例外IDとversionを残さない。
   * Session失効時に統括の`useWbsPage`から呼ばれる。
   */
  const discardWorkingDayDialogs = (): void => {
    closeWorkingDayEditorAfterOperation();
    workingDayPendingDelete.value = null;
  };

  /**
   * 稼働日例外の削除確認dialogが閉じられた場合だけ確認対象を破棄する。
   *
   * @param open dialogの新しい開閉状態
   */
  const handleWorkingDayDeleteDialogVisibility = (open: boolean): void => {
    if (!open) {
      cancelWorkingDayDelete();
    }
  };

  /** 画面の再読込時に、前回操作の結果messageを残さない。 */
  const clearWorkingCalendarMessages = (): void => {
    workingCalendarErrorMessages.value = [];
    workingCalendarSuccessMessage.value = "";
  };

  return {
    canEditSelectedWorkingCalendarTarget,
    cancelWorkingDayDelete,
    clearWorkingCalendarMessages,
    closeWorkingDayEditor,
    confirmWorkingDayDelete,
    discardWorkingDayDialogs,
    handleWorkingDayDeleteDialogVisibility,
    isDeletingWorkingDay,
    isLoadingWorkingCalendar,
    isSavingWorkingDay,
    isWorkingCalendarMutating,
    isWorkingDayEditorOpen,
    loadCurrentWorkingCalendar,
    loadWorkingCalendar,
    openWorkingDayEditor,
    requestWorkingDayDelete,
    saveWorkingDay,
    selectedWorkingCalendarTarget,
    selectedWorkingCalendarTargetDisplayName,
    submitWorkingCalendar,
    workingCalendar,
    workingCalendarDateRange,
    workingCalendarEditorErrorMessages,
    workingCalendarErrorMessages,
    workingCalendarReadOnlyMessage,
    workingCalendarSelectedTargetKey,
    workingCalendarSuccessMessage,
    workingCalendarTargetOptions,
    workingDayEditingDay,
    workingDayPendingDelete,
  };
};
