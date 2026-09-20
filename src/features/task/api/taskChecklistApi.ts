import type {
  TaskChecklistItem,
  TaskChecklistItemCreateRequest,
  TaskChecklistItemUpdateRequest,
  TaskChecklistOrderRequest,
} from "@/features/task/types/taskChecklist";
import HttpClient from "@/shared/api/httpClient";
import { API_PATHS } from "@/shared/constants/api";
import type { ErrorResponse } from "@/shared/types/error";

/** Task checklist APIのHTTPエラーをstatusとBackendエラー本文付きで表す。 */
export class TaskChecklistApiError extends Error {
  readonly status: number;

  readonly errorResponse: ErrorResponse | null;

  constructor(status: number, errorResponse: ErrorResponse | null) {
    super(`Task checklist APIの実行に失敗しました。status=${status}`);
    this.name = "TaskChecklistApiError";
    this.status = status;
    this.errorResponse = errorResponse;
  }
}

/** Task checklist APIのProject・Task階層pathを組み立てる。 */
const createPath = (projectId: number, taskId: number): string =>
  `${API_PATHS.PROJECTS}/${projectId}/tasks/${taskId}/checklist-items`;

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

/** 非2xx ResponseをTaskChecklistApiErrorへ変換する。 */
const ensureSuccess = async (response: Response): Promise<void> => {
  if (!response.ok) {
    throw new TaskChecklistApiError(
      response.status,
      await readErrorResponse(response)
    );
  }
};

/** Taskのchecklistを表示順で取得する。 */
const findItems = async (
  projectId: number,
  taskId: number
): Promise<TaskChecklistItem[]> => {
  const response = await HttpClient.getRequest(createPath(projectId, taskId));
  await ensureSuccess(response);
  return (await response.json()) as TaskChecklistItem[];
};

/** Task末尾へ未完了checklist itemを追加する。 */
const createItem = async (
  projectId: number,
  taskId: number,
  payload: TaskChecklistItemCreateRequest
): Promise<TaskChecklistItem> => {
  const response = await HttpClient.postRequest(
    createPath(projectId, taskId),
    payload
  );
  await ensureSuccess(response);
  return (await response.json()) as TaskChecklistItem;
};

/** checklist itemの本文と完了状態をversion条件付きで更新する。 */
const updateItem = async (
  projectId: number,
  taskId: number,
  itemId: number,
  payload: TaskChecklistItemUpdateRequest
): Promise<TaskChecklistItem> => {
  const response = await HttpClient.putRequest(
    `${createPath(projectId, taskId)}/${itemId}`,
    payload
  );
  await ensureSuccess(response);
  return (await response.json()) as TaskChecklistItem;
};

/** Task内の全checklist itemをRequest配列順へ並び替える。 */
const reorderItems = async (
  projectId: number,
  taskId: number,
  payload: TaskChecklistOrderRequest
): Promise<TaskChecklistItem[]> => {
  const response = await HttpClient.putRequest(
    `${createPath(projectId, taskId)}/order`,
    payload
  );
  await ensureSuccess(response);
  return (await response.json()) as TaskChecklistItem[];
};

/** checklist itemを取得時点version付きで削除する。 */
const deleteItem = async (
  projectId: number,
  taskId: number,
  itemId: number,
  version: number
): Promise<void> => {
  const query = new URLSearchParams({ version: String(version) });
  const response = await HttpClient.deleteRequest(
    `${createPath(projectId, taskId)}/${itemId}?${query}`
  );
  await ensureSuccess(response);
};

export default {
  createItem,
  deleteItem,
  findItems,
  reorderItems,
  updateItem,
};
