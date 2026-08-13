import type {
  TodoDetailResponse,
  TodoListRequest,
  TodoUpsertRequest,
} from "@/features/task/types/task";
import HttpClient from "@/shared/api/httpClient";
import { API_PATHS } from "@/shared/constants/api";

/**
 * Todo詳細を取得する。
 *
 * @param todoId Todo ID
 * @returns 認可済みTodoの詳細Response
 * @throws 未検出または参照permission不足等で非2xxが返った場合
 */
const findDetail = async (todoId: number): Promise<TodoDetailResponse> => {
  const response = await HttpClient.getRequest(
    `${API_PATHS.TODO_DETAIL}/${todoId}`
  );
  if (!response.ok) {
    throw new Error(
      `Todo詳細の取得に失敗しました。status=${response.status}`
    );
  }
  return (await response.json()) as TodoDetailResponse;
};

/**
 * 認証利用者の参照範囲でTodo一覧を検索する。
 *
 * @param payload タイトル、日付範囲、完了状態の検索条件
 * @returns 画面側でValidationエラーも解釈するBackend Response
 */
const findList = (payload: TodoListRequest): Promise<Response> =>
  HttpClient.postRequest(API_PATHS.TODO_LIST, payload);

/**
 * 認証利用者の参照範囲でTodoカレンダーを検索する。
 *
 * @param payload タイトルと完了状態の検索条件
 * @returns カレンダー用Todoを含むBackend Response
 */
const findCalendar = (payload: TodoListRequest): Promise<Response> =>
  HttpClient.postRequest(API_PATHS.TODO_CALENDAR, payload);

/**
 * 認可対象のTodoを完了状態にする。
 *
 * @param todoId 完了させるTodo ID
 * @returns 所有者または全件更新permissionをBackendが検査したResponse
 */
const complete = (todoId: number): Promise<Response> => {
  const query = new URLSearchParams({ todo_id: String(todoId) });
  return HttpClient.postRequest(`${API_PATHS.TODO_DONE}?${query}`, null);
};

/**
 * Todoを登録または更新する。
 *
 * @param payload snake_case形式のTodo入力。所有者はBackendがpermissionに応じて確定する
 * @returns 登録・更新結果Response
 */
const upsert = (payload: TodoUpsertRequest): Promise<Response> =>
  HttpClient.postRequest(API_PATHS.TODO_UPSERT, payload);

export default {
  complete,
  findCalendar,
  findDetail,
  findList,
  upsert,
};
