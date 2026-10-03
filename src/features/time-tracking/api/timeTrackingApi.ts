import type {
  CurrentTaskTimerResponse,
  TaskTimerSessionListResponse,
  TaskTimerSessionSearch,
  TaskTimerStopResponse,
  TaskTimerVersionRequest,
  TaskWorkLogAuditListResponse,
} from "@/features/time-tracking/types/timeTracking";
import HttpClient from "@/shared/api/httpClient";
import { API_PATHS } from "@/shared/constants/api";
import type { ErrorResponse } from "@/shared/types/error";

/** Time Tracking APIのHTTPエラーをstatusとBackendエラー本文付きで表す。 */
export class TimeTrackingApiError extends Error {
  readonly status: number;

  readonly errorResponse: ErrorResponse | null;

  constructor(status: number, errorResponse: ErrorResponse | null) {
    super(`Time Tracking APIの実行に失敗しました。status=${status}`);
    this.name = "TimeTrackingApiError";
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

/** 非2xx ResponseをTimeTrackingApiErrorへ変換する。 */
const ensureSuccess = async (response: Response): Promise<void> => {
  if (!response.ok) {
    throw new TimeTrackingApiError(
      response.status,
      await readErrorResponse(response)
    );
  }
};

/** 欠落した配列を画面へ伝播させないTimer停止Responseへ正規化する。 */
const normalizeStopResponse = (
  payload: TaskTimerStopResponse
): TaskTimerStopResponse => ({
  ...payload,
  allocations: payload.allocations ?? [],
});

/** 欠落した配列を画面へ伝播させないSession履歴Responseへ正規化する。 */
const normalizeSessionListResponse = (
  payload: TaskTimerSessionListResponse
): TaskTimerSessionListResponse => ({
  ...payload,
  sessions: payload.sessions ?? [],
});

/** 欠落した配列を画面へ伝播させない工数監査Responseへ正規化する。 */
const normalizeAuditListResponse = (
  payload: TaskWorkLogAuditListResponse
): TaskWorkLogAuditListResponse => ({
  ...payload,
  audits: payload.audits ?? [],
});

/**
 * 認証利用者本人のRUNNING Timerを取得する。
 *
 * @returns 現在Timer。未実行時はtimerがnull
 * @throws TimeTrackingApiError 未認証またはBackendエラーの場合
 */
const getCurrentTimer = async (): Promise<CurrentTaskTimerResponse> => {
  const response = await HttpClient.getRequest(API_PATHS.TIME_TRACKING_CURRENT);
  await ensureSuccess(response);
  return (await response.json()) as CurrentTaskTimerResponse;
};

/**
 * 指定Taskで認証利用者本人のTimerを開始する。
 *
 * @param projectId Timer対象Project ID
 * @param taskId Board・WBSと共通の通常Task ID
 * @returns Backendが確定した現在Timer
 * @throws TimeTrackingApiError 認可不足、対象なし、既存Timer競合またはBackendエラーの場合
 */
const startTimer = async (
  projectId: number,
  taskId: number
): Promise<CurrentTaskTimerResponse> => {
  const response = await HttpClient.postRequest(
    `${API_PATHS.PROJECTS}/${projectId}/tasks/${taskId}/timer/start`,
    null
  );
  await ensureSuccess(response);
  return (await response.json()) as CurrentTaskTimerResponse;
};

/**
 * 認証利用者本人のRUNNING Timerを停止し、日別実績へ反映する。
 *
 * @param request 現在Timer取得時点のversion
 * @returns 確定Sessionと日別配賦
 * @throws TimeTrackingApiError Timerなし、version・時間・日別上限競合またはBackendエラーの場合
 */
const stopCurrentTimer = async (
  request: TaskTimerVersionRequest
): Promise<TaskTimerStopResponse> => {
  const response = await HttpClient.postRequest(
    `${API_PATHS.TIME_TRACKING_CURRENT}/stop`,
    request
  );
  await ensureSuccess(response);
  return normalizeStopResponse((await response.json()) as TaskTimerStopResponse);
};

/**
 * 認証利用者本人のRUNNING Timerを実績へ反映せず取消する。
 *
 * @param request 現在Timer取得時点のversion
 * @returns Timerがnullになった現在Timer Response
 * @throws TimeTrackingApiError Timerなし、version競合またはBackendエラーの場合
 */
const cancelCurrentTimer = async (
  request: TaskTimerVersionRequest
): Promise<CurrentTaskTimerResponse> => {
  const response = await HttpClient.postRequest(
    `${API_PATHS.TIME_TRACKING_CURRENT}/cancel`,
    request
  );
  await ensureSuccess(response);
  return (await response.json()) as CurrentTaskTimerResponse;
};

/**
 * 認証利用者本人のTimer Session履歴を開始日の範囲で取得する。
 *
 * @param search Asia/Tokyo業務日の期間とpaging条件
 * @returns 本人Sessionだけを含む履歴Response
 * @throws TimeTrackingApiError 入力不正、未認証またはBackendエラーの場合
 */
const getSessions = async (
  search: TaskTimerSessionSearch
): Promise<TaskTimerSessionListResponse> => {
  const query = new URLSearchParams({
    dateFrom: search.dateFrom,
    dateTo: search.dateTo,
    page: String(search.page),
    size: String(search.size),
  });
  const response = await HttpClient.getRequest(
    `${API_PATHS.TIME_TRACKING_SESSIONS}?${query}`
  );
  await ensureSuccess(response);
  return normalizeSessionListResponse(
    (await response.json()) as TaskTimerSessionListResponse
  );
};

/**
 * 指定Taskの日別実績工数監査を取得する。
 *
 * @param projectId 監査対象Project ID
 * @param taskId 監査対象の通常Task ID
 * @param page 0始まりのページ番号
 * @param size 1ページ当たりの取得件数
 * @returns 手入力とTimer加算の監査履歴
 * @throws TimeTrackingApiError 認可不足、対象なし、入力不正またはBackendエラーの場合
 */
const getWorkLogAudits = async (
  projectId: number,
  taskId: number,
  page = 0,
  size = 50
): Promise<TaskWorkLogAuditListResponse> => {
  const query = new URLSearchParams({ page: String(page), size: String(size) });
  const response = await HttpClient.getRequest(
    `${API_PATHS.PROJECTS}/${projectId}/wbs/tasks/${taskId}/work-log-audits?${query}`
  );
  await ensureSuccess(response);
  return normalizeAuditListResponse(
    (await response.json()) as TaskWorkLogAuditListResponse
  );
};

export default {
  cancelCurrentTimer,
  getCurrentTimer,
  getSessions,
  getWorkLogAudits,
  startTimer,
  stopCurrentTimer,
};
