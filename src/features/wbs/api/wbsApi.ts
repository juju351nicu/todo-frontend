import type {
  TaskDependencyCreateRequest,
  TaskDependencyListResponse,
  TaskEffortPlanCreateRequest,
  TaskEffortPlanListResponse,
  TaskEffortPlanUpdateRequest,
  TaskWorkLogCreateRequest,
  TaskWorkLogListResponse,
  TaskWorkLogUpdateRequest,
  TaskWorkloadResponse,
  WorkingCalendarResponse,
  WorkingDayCreateRequest,
  WorkingDayUpdateRequest,
  WbsBaselineActivationRequest,
  WbsBaselineCreateRequest,
  WbsBaselineCreateResponse,
  WbsBaselineDetailResponse,
  WbsBaselineListResponse,
  WbsBaselineSummary,
  WbsResponse,
  WbsTaskUpdateRequest,
} from "@/features/wbs/types/wbs";
import HttpClient from "@/shared/api/httpClient";
import { API_PATHS } from "@/shared/constants/api";
import type { ErrorResponse } from "@/shared/types/error";

/** WBS APIのHTTPエラーをstatusとBackendエラー本文付きで表す。 */
export class WbsApiError extends Error {
  readonly status: number;

  readonly errorResponse: ErrorResponse | null;

  constructor(status: number, errorResponse: ErrorResponse | null) {
    super(`WBS APIの実行に失敗しました。status=${status}`);
    this.name = "WbsApiError";
    this.status = status;
    this.errorResponse = errorResponse;
  }
}

/** JSON形式とは限らないSecurityエラーResponseを安全に読み取る。 */
const readErrorResponse = async (
  response: Response
): Promise<ErrorResponse | null> => {
  try {
    return (await response.json()) as ErrorResponse;
  } catch (_error: unknown) {
    return null;
  }
};

/** 非2xx ResponseをWbsApiErrorへ変換する。 */
const ensureSuccess = async (response: Response): Promise<void> => {
  if (!response.ok) {
    throw new WbsApiError(response.status, await readErrorResponse(response));
  }
};

/**
 * WBS ResponseのTask配列とV6 nullable実績日を画面で扱う確定値へ正規化する。
 * V6適用前に作成したmock・fixtureから項目が欠けても、undefinedを表示層へ伝播させない。
 */
const normalizeWbsResponse = (payload: WbsResponse): WbsResponse => ({
  ...payload,
  tasks: (payload.tasks ?? []).map((task) => ({
    ...task,
    actualStartDate: task.actualStartDate ?? null,
    actualEndDate: task.actualEndDate ?? null,
  })),
});

/**
 * Projectの非archive TaskをWBS表示・編集開始用スナップショットとして取得する。
 *
 * @param projectId 参照対象Project ID
 * @returns Boardと共通のTask IDを持つWBS。Task未登録時は空配列
 * @throws WbsApiError 未認証、TASK_READ不足、Project未参加またはBackendエラーの場合
 */
const getWbs = async (projectId: number): Promise<WbsResponse> => {
  const response = await HttpClient.getRequest(
    `${API_PATHS.PROJECTS}/${projectId}/wbs`
  );
  await ensureSuccess(response);
  return normalizeWbsResponse((await response.json()) as WbsResponse);
};

/** API Responseで欠落したbaseline header一覧を空配列へ正規化する。 */
const normalizeWbsBaselineList = (
  payload: WbsBaselineListResponse
): WbsBaselineListResponse => ({
  ...payload,
  baselines: payload.baselines ?? [],
});

/** API Responseで欠落したbaseline snapshot配列を空配列へ正規化する。 */
const normalizeWbsBaselineDetail = (
  payload: WbsBaselineDetailResponse
): WbsBaselineDetailResponse => ({
  ...payload,
  tasks: payload.tasks ?? [],
  dependencies: payload.dependencies ?? [],
  effortPlans: payload.effortPlans ?? [],
});

/**
 * Projectへ保存されたWBS baseline headerを連番の新しい順で取得する。
 *
 * @param projectId baselineを所有するProject ID
 * @returns baseline未作成時は空配列を持つ一覧Response
 * @throws WbsApiError 未認証、TASK_READ不足、Project未参加またはBackendエラーの場合
 */
const getWbsBaselines = async (
  projectId: number
): Promise<WbsBaselineListResponse> => {
  const response = await HttpClient.getRequest(
    `${API_PATHS.PROJECTS}/${projectId}/wbs/baselines`
  );
  await ensureSuccess(response);
  return normalizeWbsBaselineList(
    (await response.json()) as WbsBaselineListResponse
  );
};

/**
 * 指定baselineの変更不能なTask・依存・日別予定snapshotと配賦集計を取得する。
 *
 * @param projectId baselineを所有するProject ID
 * @param baselineId 取得対象WBS baseline ID
 * @returns headerとsnapshot子行、予定工数集計
 * @throws WbsApiError 未認証、認可不足、対象なしまたはBackendエラーの場合
 */
const getWbsBaseline = async (
  projectId: number,
  baselineId: number
): Promise<WbsBaselineDetailResponse> => {
  const response = await HttpClient.getRequest(
    `${API_PATHS.PROJECTS}/${projectId}/wbs/baselines/${baselineId}`
  );
  await ensureSuccess(response);
  return normalizeWbsBaselineDetail(
    (await response.json()) as WbsBaselineDetailResponse
  );
};

/**
 * 現在のWBS Task・依存・日別予定を新しいactive baselineへ一括固定する。
 * 共通HTTP clientがSpring Session CookieとCSRF headerを設定する。
 *
 * @param projectId snapshot元Project ID
 * @param request 正規化済みbaseline名とnullable説明
 * @returns 作成したheader、snapshot件数、予定工数集計
 * @throws WbsApiError 入力不正、認可不足、対象なし、作成競合またはBackendエラーの場合
 */
const createWbsBaseline = async (
  projectId: number,
  request: WbsBaselineCreateRequest
): Promise<WbsBaselineCreateResponse> => {
  const response = await HttpClient.postRequest(
    `${API_PATHS.PROJECTS}/${projectId}/wbs/baselines`,
    request
  );
  await ensureSuccess(response);
  return (await response.json()) as WbsBaselineCreateResponse;
};

/**
 * 過去baselineを取得時点version付きで現在計画との比較対象へ切り替える。
 *
 * @param projectId baselineを所有するProject ID
 * @param baselineId activeへ切り替えるWBS baseline ID
 * @param request baseline一覧取得時点の楽観ロックversion
 * @returns active切替後のbaseline header
 * @throws WbsApiError 認可不足、対象なし、version競合またはBackendエラーの場合
 */
const activateWbsBaseline = async (
  projectId: number,
  baselineId: number,
  request: WbsBaselineActivationRequest
): Promise<WbsBaselineSummary> => {
  const response = await HttpClient.putRequest(
    `${API_PATHS.PROJECTS}/${projectId}/wbs/baselines/${baselineId}/activation`,
    request
  );
  await ensureSuccess(response);
  return (await response.json()) as WbsBaselineSummary;
};

/**
 * 既存TaskのWBS固有項目を楽観ロック付きで更新する。
 *
 * @param projectId 更新対象Taskが所属するProject ID
 * @param taskId 更新対象Task ID
 * @param request 階層、種別、予定、進捗、nullableな実績期間と取得時点のversion
 * @returns 更新確定後のProject WBS全体
 * @throws WbsApiError 入力不正、認可不足、対象なし、version競合またはBackendエラーの場合
 */
const updateWbsTask = async (
  projectId: number,
  taskId: number,
  request: WbsTaskUpdateRequest
): Promise<WbsResponse> => {
  const response = await HttpClient.putRequest(
    `${API_PATHS.PROJECTS}/${projectId}/wbs/tasks/${taskId}`,
    request
  );
  await ensureSuccess(response);
  return normalizeWbsResponse((await response.json()) as WbsResponse);
};

/**
 * Project内の非archive Task間に保存された依存関係を取得する。
 *
 * @param projectId 参照対象Project ID
 * @returns Task依存関係ID順の一覧。未登録時は空配列
 * @throws WbsApiError 未認証、TASK_READ不足、Project未参加またはBackendエラーの場合
 */
const getTaskDependencies = async (
  projectId: number
): Promise<TaskDependencyListResponse> => {
  const response = await HttpClient.getRequest(
    `${API_PATHS.PROJECTS}/${projectId}/wbs/dependencies`
  );
  await ensureSuccess(response);
  const payload = (await response.json()) as TaskDependencyListResponse;
  return {
    ...payload,
    dependencies: payload.dependencies ?? [],
  };
};

/**
 * 同じProjectの2つのTaskへFinish-to-Start依存関係を追加する。
 * 共通HTTP clientがSession CookieとCSRF headerを設定する。
 *
 * @param projectId 依存関係を所有するProject ID
 * @param request 先行Task、後続Task、待ち時間を含む検証済みRequest
 * @returns 作成確定後のProject内Task依存関係一覧
 * @throws WbsApiError 入力不正、認可不足、対象なし、重複・循環・状態競合またはBackendエラーの場合
 */
const createTaskDependency = async (
  projectId: number,
  request: TaskDependencyCreateRequest
): Promise<TaskDependencyListResponse> => {
  const response = await HttpClient.postRequest(
    `${API_PATHS.PROJECTS}/${projectId}/wbs/dependencies`,
    request
  );
  await ensureSuccess(response);
  const payload = (await response.json()) as TaskDependencyListResponse;
  return {
    ...payload,
    dependencies: payload.dependencies ?? [],
  };
};

/**
 * Task依存関係を取得時点version付きで削除する。
 * 204 Responseを削除確定として扱い、Response bodyは読み取らない。
 *
 * @param projectId 依存関係を所有するProject ID
 * @param dependencyId 削除するTask依存関係ID
 * @param version 一覧取得時点の楽観ロックversion
 * @throws WbsApiError 認可不足、対象なし、version・状態競合またはBackendエラーの場合
 */
const deleteTaskDependency = async (
  projectId: number,
  dependencyId: number,
  version: number
): Promise<void> => {
  const response = await HttpClient.deleteRequest(
    `${API_PATHS.PROJECTS}/${projectId}/wbs/dependencies/${dependencyId}?version=${encodeURIComponent(String(version))}`
  );
  await ensureSuccess(response);
};

/** API Responseの欠落したworkLogsを画面へ伝播させず空配列へ正規化する。 */
const normalizeTaskWorkLogList = (
  payload: TaskWorkLogListResponse
): TaskWorkLogListResponse => ({
  ...payload,
  workLogs: payload.workLogs ?? [],
});

/**
 * 通常Taskへ登録された日別実績工数と合計工数を取得する。
 *
 * @param projectId 実績工数を所有するProject ID
 * @param taskId Board・WBSと共通の通常Task ID
 * @returns 業務日順の日別実績と分単位合計
 * @throws WbsApiError 未認証、TASK_READ不足、Project未参加、対象なしまたはBackendエラーの場合
 */
const getTaskWorkLogs = async (
  projectId: number,
  taskId: number
): Promise<TaskWorkLogListResponse> => {
  const response = await HttpClient.getRequest(
    `${API_PATHS.PROJECTS}/${projectId}/wbs/tasks/${taskId}/work-logs`
  );
  await ensureSuccess(response);
  return normalizeTaskWorkLogList(
    (await response.json()) as TaskWorkLogListResponse
  );
};

/**
 * 通常Taskへ1作業者・1業務日単位の実績工数を登録する。
 *
 * @param projectId 実績工数を所有するProject ID
 * @param taskId Board・WBSと共通の通常Task ID
 * @param request 業務日、実績工数、Project memberの作業者ID
 * @returns 登録確定後の日別実績工数一覧
 * @throws WbsApiError 入力不正、認可不足、対象なし、重複・状態競合またはBackendエラーの場合
 */
const createTaskWorkLog = async (
  projectId: number,
  taskId: number,
  request: TaskWorkLogCreateRequest
): Promise<TaskWorkLogListResponse> => {
  const response = await HttpClient.postRequest(
    `${API_PATHS.PROJECTS}/${projectId}/wbs/tasks/${taskId}/work-logs`,
    request
  );
  await ensureSuccess(response);
  return normalizeTaskWorkLogList(
    (await response.json()) as TaskWorkLogListResponse
  );
};

/**
 * 保存済みTask日別実績を取得時点version付きで更新する。
 *
 * @param projectId 実績工数を所有するProject ID
 * @param taskId Board・WBSと共通の通常Task ID
 * @param workLogId 更新対象の日別実績工数ID
 * @param request 更新後の値と取得時点version
 * @returns 更新確定後の日別実績工数一覧
 * @throws WbsApiError 入力不正、認可不足、対象なし、重複・version・状態競合またはBackendエラーの場合
 */
const updateTaskWorkLog = async (
  projectId: number,
  taskId: number,
  workLogId: number,
  request: TaskWorkLogUpdateRequest
): Promise<TaskWorkLogListResponse> => {
  const response = await HttpClient.putRequest(
    `${API_PATHS.PROJECTS}/${projectId}/wbs/tasks/${taskId}/work-logs/${workLogId}`,
    request
  );
  await ensureSuccess(response);
  return normalizeTaskWorkLogList(
    (await response.json()) as TaskWorkLogListResponse
  );
};

/**
 * Task日別実績を取得時点version付きで削除する。
 *
 * @param projectId 実績工数を所有するProject ID
 * @param taskId Board・WBSと共通の通常Task ID
 * @param workLogId 削除対象の日別実績工数ID
 * @param version 一覧取得時点の楽観ロックversion
 * @throws WbsApiError 認可不足、対象なし、version・状態競合またはBackendエラーの場合
 */
const deleteTaskWorkLog = async (
  projectId: number,
  taskId: number,
  workLogId: number,
  version: number
): Promise<void> => {
  const response = await HttpClient.deleteRequest(
    `${API_PATHS.PROJECTS}/${projectId}/wbs/tasks/${taskId}/work-logs/${workLogId}?version=${encodeURIComponent(String(version))}`
  );
  await ensureSuccess(response);
};

/** API Responseの欠落したeffortPlansを画面へ伝播させず空配列へ正規化する。 */
const normalizeTaskEffortPlanList = (
  payload: TaskEffortPlanListResponse
): TaskEffortPlanListResponse => ({
  ...payload,
  effortPlans: payload.effortPlans ?? [],
});

/**
 * 通常Taskへ登録された日別予定工数、Task全体予定、未配賦工数を取得する。
 *
 * @param projectId 日別予定工数を所有するProject ID
 * @param taskId Board・WBSと共通の通常Task ID
 * @returns 予定日順の日別予定と分単位の配賦状況
 * @throws WbsApiError 未認証、TASK_READ不足、Project未参加、対象なしまたはBackendエラーの場合
 */
const getTaskEffortPlans = async (
  projectId: number,
  taskId: number
): Promise<TaskEffortPlanListResponse> => {
  const response = await HttpClient.getRequest(
    `${API_PATHS.PROJECTS}/${projectId}/wbs/tasks/${taskId}/effort-plans`
  );
  await ensureSuccess(response);
  return normalizeTaskEffortPlanList(
    (await response.json()) as TaskEffortPlanListResponse
  );
};

/**
 * 通常Taskへ1予定担当者・1業務日単位の日別予定工数を登録する。
 *
 * @param projectId 日別予定工数を所有するProject ID
 * @param taskId Board・WBSと共通の通常Task ID
 * @param request 予定日、予定工数、Project memberの予定担当者ID
 * @returns 登録確定後の日別予定工数一覧
 * @throws WbsApiError 入力不正、認可不足、対象なし、重複・状態競合またはBackendエラーの場合
 */
const createTaskEffortPlan = async (
  projectId: number,
  taskId: number,
  request: TaskEffortPlanCreateRequest
): Promise<TaskEffortPlanListResponse> => {
  const response = await HttpClient.postRequest(
    `${API_PATHS.PROJECTS}/${projectId}/wbs/tasks/${taskId}/effort-plans`,
    request
  );
  await ensureSuccess(response);
  return normalizeTaskEffortPlanList(
    (await response.json()) as TaskEffortPlanListResponse
  );
};

/**
 * 保存済みTask日別予定を取得時点version付きで更新する。
 *
 * @param projectId 日別予定工数を所有するProject ID
 * @param taskId Board・WBSと共通の通常Task ID
 * @param effortPlanId 更新対象の日別予定工数ID
 * @param request 更新後の値と取得時点version
 * @returns 更新確定後の日別予定工数一覧
 * @throws WbsApiError 入力不正、認可不足、対象なし、重複・version・状態競合またはBackendエラーの場合
 */
const updateTaskEffortPlan = async (
  projectId: number,
  taskId: number,
  effortPlanId: number,
  request: TaskEffortPlanUpdateRequest
): Promise<TaskEffortPlanListResponse> => {
  const response = await HttpClient.putRequest(
    `${API_PATHS.PROJECTS}/${projectId}/wbs/tasks/${taskId}/effort-plans/${effortPlanId}`,
    request
  );
  await ensureSuccess(response);
  return normalizeTaskEffortPlanList(
    (await response.json()) as TaskEffortPlanListResponse
  );
};

/**
 * Task日別予定を取得時点version付きで削除する。
 *
 * @param projectId 日別予定工数を所有するProject ID
 * @param taskId Board・WBSと共通の通常Task ID
 * @param effortPlanId 削除対象の日別予定工数ID
 * @param version 一覧取得時点の楽観ロックversion
 * @throws WbsApiError 認可不足、対象なし、version・状態競合またはBackendエラーの場合
 */
const deleteTaskEffortPlan = async (
  projectId: number,
  taskId: number,
  effortPlanId: number,
  version: number
): Promise<void> => {
  const response = await HttpClient.deleteRequest(
    `${API_PATHS.PROJECTS}/${projectId}/wbs/tasks/${taskId}/effort-plans/${effortPlanId}?version=${encodeURIComponent(String(version))}`
  );
  await ensureSuccess(response);
};

/**
 * Project内の日別予定・実績を指定期間の日付・担当者単位で比較する。
 *
 * @param projectId workloadを所有するProject ID
 * @param dateFrom 集計開始日。境界を含むyyyy-MM-dd
 * @param dateTo 集計終了日。境界を含むyyyy-MM-dd
 * @returns 予定・実績・差分の期間合計と担当者別日次行
 * @throws WbsApiError 期間不正、未認証、TASK_READ不足、Project未参加またはBackendエラーの場合
 */
const getTaskWorkload = async (
  projectId: number,
  dateFrom: string,
  dateTo: string
): Promise<TaskWorkloadResponse> => {
  const query = new URLSearchParams({ dateFrom, dateTo });
  const response = await HttpClient.getRequest(
    `${API_PATHS.PROJECTS}/${projectId}/wbs/workload?${query.toString()}`
  );
  await ensureSuccess(response);
  const payload = (await response.json()) as TaskWorkloadResponse;
  return {
    ...payload,
    workloads: payload.workloads ?? [],
  };
};

/** API Responseで欠落したcalendar日付一覧を画面へ伝播させず空配列へ正規化する。 */
const normalizeWorkingCalendar = (
  payload: WorkingCalendarResponse
): WorkingCalendarResponse => ({
  ...payload,
  accountId: payload.accountId ?? null,
  days: payload.days ?? [],
});

/**
 * Project共通または指定Project memberの有効な稼働日calendarを取得する。
 *
 * @param projectId calendarを所有するProject ID
 * @param dateFrom 検索開始日。境界を含むyyyy-MM-dd
 * @param dateTo 検索終了日。境界を含むyyyy-MM-dd
 * @param accountId member固有calendarの対象。Project共通参照ではnull
 * @returns 既定値、Project例外、member例外を優先順位解決した全日付
 * @throws WbsApiError 期間・member不正、認証・認可不足、Project未参加またはBackendエラーの場合
 */
const getWorkingCalendar = async (
  projectId: number,
  dateFrom: string,
  dateTo: string,
  accountId: number | null
): Promise<WorkingCalendarResponse> => {
  const query = new URLSearchParams({ dateFrom, dateTo });
  if (accountId !== null) {
    query.set("accountId", String(accountId));
  }
  const response = await HttpClient.getRequest(
    `${API_PATHS.PROJECTS}/${projectId}/wbs/calendar?${query.toString()}`
  );
  await ensureSuccess(response);
  return normalizeWorkingCalendar(
    (await response.json()) as WorkingCalendarResponse
  );
};

/**
 * Project共通の日別稼働条件を登録する。
 *
 * @param projectId 例外を所有するProject ID
 * @param request 設定日、稼働日種別、分単位稼働可能時間
 * @returns 登録した1日分のProject共通calendar
 * @throws WbsApiError 入力不正、認可不足、Project未参加、同日重複・状態競合またはBackendエラーの場合
 */
const createProjectWorkingDay = async (
  projectId: number,
  request: WorkingDayCreateRequest
): Promise<WorkingCalendarResponse> => {
  const response = await HttpClient.postRequest(
    `${API_PATHS.PROJECTS}/${projectId}/wbs/calendar/project-days`,
    request
  );
  await ensureSuccess(response);
  return normalizeWorkingCalendar(
    (await response.json()) as WorkingCalendarResponse
  );
};

/**
 * Project共通の日別稼働条件を取得時点version付きで更新する。
 *
 * @param projectId 例外を所有するProject ID
 * @param workingDayId 更新対象のProject共通例外ID
 * @param request 更新値とcalendar取得時点version
 * @returns 更新した1日分のProject共通calendar
 * @throws WbsApiError 入力不正、認可不足、対象なし、同日重複・version・状態競合またはBackendエラーの場合
 */
const updateProjectWorkingDay = async (
  projectId: number,
  workingDayId: number,
  request: WorkingDayUpdateRequest
): Promise<WorkingCalendarResponse> => {
  const response = await HttpClient.putRequest(
    `${API_PATHS.PROJECTS}/${projectId}/wbs/calendar/project-days/${workingDayId}`,
    request
  );
  await ensureSuccess(response);
  return normalizeWorkingCalendar(
    (await response.json()) as WorkingCalendarResponse
  );
};

/**
 * Project共通の日別稼働条件を取得時点version付きで削除する。
 *
 * @param projectId 例外を所有するProject ID
 * @param workingDayId 削除対象のProject共通例外ID
 * @param version calendar取得時点の楽観ロックversion
 * @throws WbsApiError 認可不足、対象なし、version・状態競合またはBackendエラーの場合
 */
const deleteProjectWorkingDay = async (
  projectId: number,
  workingDayId: number,
  version: number
): Promise<void> => {
  const response = await HttpClient.deleteRequest(
    `${API_PATHS.PROJECTS}/${projectId}/wbs/calendar/project-days/${workingDayId}?version=${encodeURIComponent(String(version))}`
  );
  await ensureSuccess(response);
};

/**
 * Project member固有の日別稼働条件を本人またはProject管理者として登録する。
 *
 * @param projectId 例外を所有するProject ID
 * @param accountId 個人例外の対象Project memberアカウントID
 * @param request 設定日、稼働日種別、分単位稼働可能時間
 * @returns 登録した1日分のmember calendar
 * @throws WbsApiError 入力不正、認可不足、対象memberなし、同日重複・状態競合またはBackendエラーの場合
 */
const createMemberWorkingDay = async (
  projectId: number,
  accountId: number,
  request: WorkingDayCreateRequest
): Promise<WorkingCalendarResponse> => {
  const response = await HttpClient.postRequest(
    `${API_PATHS.PROJECTS}/${projectId}/wbs/calendar/members/${accountId}/days`,
    request
  );
  await ensureSuccess(response);
  return normalizeWorkingCalendar(
    (await response.json()) as WorkingCalendarResponse
  );
};

/**
 * Project member固有の日別稼働条件を取得時点version付きで更新する。
 *
 * @param projectId 例外を所有するProject ID
 * @param accountId 個人例外の対象Project memberアカウントID
 * @param workingDayId 更新対象のmember固有例外ID
 * @param request 更新値とcalendar取得時点version
 * @returns 更新した1日分のmember calendar
 * @throws WbsApiError 入力不正、認可不足、対象なし、同日重複・version・状態競合またはBackendエラーの場合
 */
const updateMemberWorkingDay = async (
  projectId: number,
  accountId: number,
  workingDayId: number,
  request: WorkingDayUpdateRequest
): Promise<WorkingCalendarResponse> => {
  const response = await HttpClient.putRequest(
    `${API_PATHS.PROJECTS}/${projectId}/wbs/calendar/members/${accountId}/days/${workingDayId}`,
    request
  );
  await ensureSuccess(response);
  return normalizeWorkingCalendar(
    (await response.json()) as WorkingCalendarResponse
  );
};

/**
 * Project member固有の日別稼働条件を取得時点version付きで削除する。
 *
 * @param projectId 例外を所有するProject ID
 * @param accountId 個人例外の対象Project memberアカウントID
 * @param workingDayId 削除対象のmember固有例外ID
 * @param version calendar取得時点の楽観ロックversion
 * @throws WbsApiError 認可不足、対象なし、version・状態競合またはBackendエラーの場合
 */
const deleteMemberWorkingDay = async (
  projectId: number,
  accountId: number,
  workingDayId: number,
  version: number
): Promise<void> => {
  const response = await HttpClient.deleteRequest(
    `${API_PATHS.PROJECTS}/${projectId}/wbs/calendar/members/${accountId}/days/${workingDayId}?version=${encodeURIComponent(String(version))}`
  );
  await ensureSuccess(response);
};

export default {
  activateWbsBaseline,
  createWbsBaseline,
  createMemberWorkingDay,
  createProjectWorkingDay,
  createTaskDependency,
  createTaskEffortPlan,
  createTaskWorkLog,
  deleteTaskDependency,
  deleteTaskEffortPlan,
  deleteTaskWorkLog,
  deleteMemberWorkingDay,
  deleteProjectWorkingDay,
  getTaskDependencies,
  getTaskEffortPlans,
  getTaskWorkLogs,
  getTaskWorkload,
  getWorkingCalendar,
  getWbs,
  getWbsBaseline,
  getWbsBaselines,
  updateTaskEffortPlan,
  updateTaskWorkLog,
  updateMemberWorkingDay,
  updateProjectWorkingDay,
  updateWbsTask,
};
