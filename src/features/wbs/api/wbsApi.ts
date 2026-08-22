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

export default {
  createTaskDependency,
  createTaskEffortPlan,
  createTaskWorkLog,
  deleteTaskDependency,
  deleteTaskEffortPlan,
  deleteTaskWorkLog,
  getTaskDependencies,
  getTaskEffortPlans,
  getTaskWorkLogs,
  getTaskWorkload,
  getWbs,
  updateTaskEffortPlan,
  updateTaskWorkLog,
  updateWbsTask,
};
