import type {
  TaskSavedView,
  TaskSavedViewCreateRequest,
  TaskSavedViewUpdateRequest,
  TaskSearchFilters,
  TaskSearchListResponse,
  TaskSearchOptionsResponse,
} from "@/features/task/types/taskSearch";
import HttpClient from "@/shared/api/httpClient";
import { API_PATHS } from "@/shared/constants/api";
import type { ErrorResponse } from "@/shared/types/error";

/** Task検索・Saved View APIのHTTPエラーをstatusとBackendエラー本文付きで表す。 */
export class TaskSearchApiError extends Error {
  readonly status: number;

  readonly errorResponse: ErrorResponse | null;

  constructor(status: number, errorResponse: ErrorResponse | null) {
    super(`Task検索APIの実行に失敗しました。status=${status}`);
    this.name = "TaskSearchApiError";
    this.status = status;
    this.errorResponse = errorResponse;
  }
}

/** JSONとは限らないSecurityエラーResponseを安全に読み取る。 */
const readErrorResponse = async (
  response: Response
): Promise<ErrorResponse | null> => {
  try {
    return (await response.json()) as ErrorResponse;
  } catch (_error: unknown) {
    return null;
  }
};

/** 非2xx ResponseをTaskSearchApiErrorへ変換する。 */
const ensureSuccess = async (response: Response): Promise<void> => {
  if (!response.ok) {
    throw new TaskSearchApiError(response.status, await readErrorResponse(response));
  }
};

/** null・空文字を除外し、BackendのcamelCase query parameterへ変換する。 */
const buildSearchQuery = (filters: TaskSearchFilters): URLSearchParams => {
  const query = new URLSearchParams();
  const keyword = filters.keyword.trim();
  if (keyword) query.set("keyword", keyword);
  if (filters.projectId !== null)
    query.set("projectId", String(filters.projectId));
  if (filters.assigneeAccountId !== null)
    query.set("assigneeAccountId", String(filters.assigneeAccountId));
  if (filters.statusCode) query.set("statusCode", filters.statusCode);
  if (filters.dueFrom) query.set("dueFrom", filters.dueFrom);
  if (filters.dueTo) query.set("dueTo", filters.dueTo);
  if (filters.priority !== null)
    query.set("priority", String(filters.priority));
  return query;
};

/**
 * 認証主体のProject参照範囲でTaskを横断検索する。
 *
 * @param filters Project、担当者、状態、期限、優先度、キーワード条件
 * @returns Backendで全条件を適用した最大100件
 * @throws TaskSearchApiError 未認証、permission不足、入力不正またはBackendエラーの場合
 */
export const searchTasks = async (
  filters: TaskSearchFilters
): Promise<TaskSearchListResponse> => {
  const query = buildSearchQuery(filters);
  const suffix = query.size > 0 ? `?${query.toString()}` : "";
  const response = await HttpClient.getRequest(`${API_PATHS.TASK_SEARCH}${suffix}`);
  await ensureSuccess(response);
  return (await response.json()) as TaskSearchListResponse;
};

/**
 * 認証主体が利用できるTask検索候補を取得する。
 *
 * @param projectId 担当者・状態候補を限定するProject ID。全Projectはnull
 * @returns Project、担当者、状態候補
 * @throws TaskSearchApiError 未認証、permission不足またはBackendエラーの場合
 */
export const getTaskSearchOptions = async (
  projectId: number | null
): Promise<TaskSearchOptionsResponse> => {
  const suffix = projectId === null ? "" : `?projectId=${projectId}`;
  const response = await HttpClient.getRequest(
    `${API_PATHS.TASK_SEARCH_OPTIONS}${suffix}`
  );
  await ensureSuccess(response);
  return (await response.json()) as TaskSearchOptionsResponse;
};

/** 本人所有のTask Saved Viewを名称順で取得する。 */
export const getTaskSavedViews = async (): Promise<TaskSavedView[]> => {
  const response = await HttpClient.getRequest(API_PATHS.TASK_SAVED_VIEWS);
  await ensureSuccess(response);
  return (await response.json()) as TaskSavedView[];
};

/** CSRF付きで本人用Task Saved Viewを登録する。 */
export const createTaskSavedView = async (
  request: TaskSavedViewCreateRequest
): Promise<TaskSavedView> => {
  const response = await HttpClient.postRequest(
    API_PATHS.TASK_SAVED_VIEWS,
    request
  );
  await ensureSuccess(response);
  return (await response.json()) as TaskSavedView;
};

/** CSRF・version付きで本人所有Task Saved Viewを更新する。 */
export const updateTaskSavedView = async (
  savedViewId: number,
  request: TaskSavedViewUpdateRequest
): Promise<TaskSavedView> => {
  const response = await HttpClient.putRequest(
    `${API_PATHS.TASK_SAVED_VIEWS}/${savedViewId}`,
    request
  );
  await ensureSuccess(response);
  return (await response.json()) as TaskSavedView;
};

/** CSRF・version付きで本人所有Task Saved Viewを削除する。 */
export const deleteTaskSavedView = async (
  savedViewId: number,
  version: number
): Promise<void> => {
  const response = await HttpClient.deleteRequest(
    `${API_PATHS.TASK_SAVED_VIEWS}/${savedViewId}?version=${version}`
  );
  await ensureSuccess(response);
};
