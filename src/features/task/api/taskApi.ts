import Const from "@/constants/const";
import type {
  TodoDetailResponse,
  TodoListRequest,
  TodoUpsertRequest,
} from "@/features/task/types/task";
import HttpClient from "@/shared/api/httpClient";

/**
 * Todo詳細を取得する。
 *
 * @param todoId Todo ID
 */
const findDetail = async (todoId: number): Promise<TodoDetailResponse> => {
  const response = await HttpClient.getRequest(
    `${Const.REST_PATH.TODO_DETAIL}/${todoId}`
  );
  if (!response.ok) {
    throw new Error(
      `Todo詳細の取得に失敗しました。status=${response.status}`
    );
  }
  return (await response.json()) as TodoDetailResponse;
};

/** Todo一覧を検索する。 */
const findList = (payload: TodoListRequest): Promise<Response> =>
  HttpClient.postRequest(Const.REST_PATH.TODO_LIST, payload);

/** Todoカレンダーを検索する。 */
const findCalendar = (payload: TodoListRequest): Promise<Response> =>
  HttpClient.postRequest(Const.REST_PATH.TODO_CALENDAR, payload);

/** Todoを完了状態にする。 */
const complete = (todoId: number): Promise<Response> => {
  const query = new URLSearchParams({ todo_id: String(todoId) });
  return HttpClient.postRequest(`${Const.REST_PATH.TODO_DONE}?${query}`, null);
};

/** Todoを登録または更新する。 */
const upsert = (payload: TodoUpsertRequest): Promise<Response> =>
  HttpClient.postRequest(Const.REST_PATH.TODO_UPSERT, payload);

export default {
  complete,
  findCalendar,
  findDetail,
  findList,
  upsert,
};
