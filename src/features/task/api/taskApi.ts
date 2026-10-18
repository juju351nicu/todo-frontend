import type {
  MyTaskListResponse,
  TodoDetailResponse,
  TodoListRequest,
  TodoListResponse,
  TodoUpsertRequest,
} from "@/features/task/types/task";
import HttpClient from "@/shared/api/httpClient";
import { API_PATHS } from "@/shared/constants/api";
import type { ErrorResponse } from "@/shared/types/error";
import { ensureApiSuccess } from "@/shared/utils/apiError";

/** Task APIのHTTPエラーをstatusとBackendエラー本文付きで表す。 */
export class TaskApiError extends Error {
  readonly status: number;

  readonly errorResponse: ErrorResponse | null;

  constructor(status: number, errorResponse: ErrorResponse | null) {
    super(`Task APIの実行に失敗しました。status=${status}`);
    this.name = "TaskApiError";
    this.status = status;
    this.errorResponse = errorResponse;
  }
}

/** 非2xx Responseを本文形式に依存しないTaskApiErrorへ変換する。 */
const ensureSuccess = (response: Response): Promise<void> =>
  ensureApiSuccess(
    response,
    (status, errorResponse) => new TaskApiError(status, errorResponse)
  );

/**
 * Todo詳細を取得する。
 *
 * @param todoId Todo ID
 * @returns 認可済みTodoの詳細Response
 * @throws TaskApiError 未検出、認証・認可失敗またはBackendエラーの場合
 */
const findDetail = async (todoId: number): Promise<TodoDetailResponse> => {
  const response = await HttpClient.getRequest(
    `${API_PATHS.TODO_DETAIL}/${todoId}`
  );
  await ensureSuccess(response);
  return (await response.json()) as TodoDetailResponse;
};

/**
 * 認証利用者本人が担当する未完了Project Taskを取得する。
 *
 * @returns Backendが本人・Project・状態・期限を確定したMy Tasks Response
 * @throws TaskApiError 未認証、参照permission不足またはBackendエラーの場合
 */
const findMyTasks = async (): Promise<MyTaskListResponse> => {
  const response = await HttpClient.getRequest(API_PATHS.MY_TASKS);
  await ensureSuccess(response);
  return (await response.json()) as MyTaskListResponse;
};

/**
 * 認証利用者の参照範囲でTodo一覧を検索する。
 *
 * @param payload タイトル、日付範囲、完了状態の検索条件
 * @returns 認可・Validation確認済みのTodo一覧
 * @throws TaskApiError 入力不正、認証・認可失敗またはBackendエラーの場合
 */
const findList = async (payload: TodoListRequest): Promise<TodoListResponse> => {
  const response = await HttpClient.postRequest(API_PATHS.TODO_LIST, payload);
  await ensureSuccess(response);
  return (await response.json()) as TodoListResponse;
};

/**
 * 認証利用者の参照範囲でTodoカレンダーを検索する。
 *
 * @param payload タイトルと完了状態の検索条件
 * @returns カレンダー用Todoを含む認可済み一覧
 * @throws TaskApiError 入力不正、認証・認可失敗またはBackendエラーの場合
 */
const findCalendar = async (
  payload: TodoListRequest
): Promise<TodoListResponse> => {
  const response = await HttpClient.postRequest(API_PATHS.TODO_CALENDAR, payload);
  await ensureSuccess(response);
  return (await response.json()) as TodoListResponse;
};

/**
 * 認可対象のTodoを完了状態にする。
 *
 * @param todoId 完了させるTodo ID
 * @throws TaskApiError 認証・認可失敗または対象未検出の場合
 */
const complete = async (todoId: number): Promise<void> => {
  const query = new URLSearchParams({ todo_id: String(todoId) });
  const response = await HttpClient.postRequest(
    `${API_PATHS.TODO_DONE}?${query}`,
    null
  );
  await ensureSuccess(response);
};

/**
 * Todoを登録または更新する。
 *
 * @param payload snake_case形式のTodo入力。所有者はBackendがpermissionに応じて確定する
 * @throws TaskApiError 入力不正、認証・認可失敗または競合の場合
 */
const upsert = async (payload: TodoUpsertRequest): Promise<void> => {
  const response = await HttpClient.postRequest(API_PATHS.TODO_UPSERT, payload);
  await ensureSuccess(response);
};

export default {
  complete,
  findCalendar,
  findDetail,
  findList,
  findMyTasks,
  upsert,
};
