import type {
  TaskListDetailResponse,
  TaskListSearchRequest,
  TaskListSearchResponse,
  TaskListUpsertRequest,
} from "@/features/task-list/types/taskList";
import HttpClient from "@/shared/api/httpClient";
import { API_PATHS } from "@/shared/constants/api";
import type { ErrorResponse } from "@/shared/types/error";
import { ApiError, ensureApiSuccess } from "@/shared/utils/apiError";

/** Task一覧APIのHTTPエラーをstatusとBackendエラー本文付きで表す。 */
export class TaskListApiError extends ApiError {
  constructor(status: number, errorResponse: ErrorResponse | null) {
    super("TaskListApiError", "Task一覧API", status, errorResponse);
  }
}

/** 非2xx Responseを本文形式に依存しないTaskListApiErrorへ変換する。 */
const ensureSuccess = (response: Response): Promise<void> =>
  ensureApiSuccess(
    response,
    (status, errorResponse) => new TaskListApiError(status, errorResponse)
  );

/**
 * Task詳細を取得する。
 *
 * @param taskId Task ID
 * @returns 認可済みTaskの詳細Response
 * @throws TaskListApiError 未検出、認証・認可失敗またはBackendエラーの場合
 */
const findDetail = async (taskId: number): Promise<TaskListDetailResponse> => {
  const response = await HttpClient.getRequest(`${API_PATHS.TASK_LIST_DETAIL}/${taskId}`);
  await ensureSuccess(response);
  return (await response.json()) as TaskListDetailResponse;
};

/**
 * 認証利用者の参照範囲でTask一覧を検索する。
 *
 * @param payload タイトル、日付範囲、完了状態の検索条件
 * @returns 認可・Validation確認済みのTask一覧
 * @throws TaskListApiError 入力不正、認証・認可失敗またはBackendエラーの場合
 */
const findList = async (payload: TaskListSearchRequest): Promise<TaskListSearchResponse> => {
  const response = await HttpClient.postRequest(API_PATHS.TASK_LIST_SEARCH, payload);
  await ensureSuccess(response);
  return (await response.json()) as TaskListSearchResponse;
};

/**
 * 認証利用者の参照範囲でTaskカレンダーを検索する。
 *
 * @param payload タイトルと完了状態の検索条件
 * @returns カレンダー用Taskを含む認可済み一覧
 * @throws TaskListApiError 入力不正、認証・認可失敗またはBackendエラーの場合
 */
const findCalendar = async (payload: TaskListSearchRequest): Promise<TaskListSearchResponse> => {
  const response = await HttpClient.postRequest(API_PATHS.TASK_LIST_CALENDAR, payload);
  await ensureSuccess(response);
  return (await response.json()) as TaskListSearchResponse;
};

/**
 * 認可対象のTaskを完了状態にする。
 *
 * @param taskId 完了させるTask ID
 * @throws TaskListApiError 認証・認可失敗または対象未検出の場合
 */
const complete = async (taskId: number): Promise<void> => {
  const query = new URLSearchParams({ task_id: String(taskId) });
  const response = await HttpClient.postRequest(`${API_PATHS.TASK_LIST_DONE}?${query}`, null);
  await ensureSuccess(response);
};

/**
 * Taskを登録または更新する。
 *
 * @param payload snake_case形式のTask入力。所有者はBackendがpermissionに応じて確定する
 * @throws TaskListApiError 入力不正、認証・認可失敗または競合の場合
 */
const upsert = async (payload: TaskListUpsertRequest): Promise<void> => {
  const response = await HttpClient.postRequest(API_PATHS.TASK_LIST_UPSERT, payload);
  await ensureSuccess(response);
};

export default {
  complete,
  findCalendar,
  findDetail,
  findList,
  upsert,
};
