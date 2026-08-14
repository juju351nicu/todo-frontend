import type {
  TaskBoard,
  TaskCreateRequest,
  TaskDetail,
  TaskMoveRequest,
  TaskUpdateRequest,
} from "@/features/project/types/project";
import HttpClient from "@/shared/api/httpClient";
import { API_PATHS } from "@/shared/constants/api";
import type { ErrorResponse } from "@/shared/types/error";

/** Project Task APIのHTTPエラーをstatusとBackendエラー本文付きで表す。 */
export class ProjectTaskApiError extends Error {
  readonly status: number;

  readonly errorResponse: ErrorResponse | null;

  constructor(status: number, errorResponse: ErrorResponse | null) {
    super(`Project Task APIの実行に失敗しました。status=${status}`);
    this.name = "ProjectTaskApiError";
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

/** 非2xx ResponseをProjectTaskApiErrorへ変換する。 */
const ensureSuccess = async (response: Response): Promise<void> => {
  if (!response.ok) {
    throw new ProjectTaskApiError(
      response.status,
      await readErrorResponse(response)
    );
  }
};

/**
 * Projectへ新しいTaskを登録する。
 *
 * @param projectId 登録先Project ID
 * @param payload Task入力値と配置先status
 * @returns 登録後のTask詳細
 * @throws ProjectTaskApiError 入力不正、認可失敗またはBackendエラーの場合
 */
const createTask = async (
  projectId: number,
  payload: TaskCreateRequest
): Promise<TaskDetail> => {
  const response = await HttpClient.postRequest(
    `${API_PATHS.PROJECTS}/${projectId}/tasks`,
    payload
  );
  await ensureSuccess(response);
  return (await response.json()) as TaskDetail;
};

/**
 * Task編集時点の最新versionを取得する。
 *
 * @param projectId 所属Project ID
 * @param taskId 参照対象Task ID
 * @returns Task詳細
 * @throws ProjectTaskApiError 認可失敗または未検出の場合
 */
const getTask = async (projectId: number, taskId: number): Promise<TaskDetail> => {
  const response = await HttpClient.getRequest(
    `${API_PATHS.PROJECTS}/${projectId}/tasks/${taskId}`
  );
  await ensureSuccess(response);
  return (await response.json()) as TaskDetail;
};

/**
 * Taskを指定列の隣接Task間へ楽観ロック付きで移動する。
 *
 * @param projectId 所属Project ID
 * @param taskId 移動対象Task ID
 * @param payload 移動先列、移動後の前後Task ID、移動前version
 * @returns Backendが再採番を確定したProject Board
 * @throws ProjectTaskApiError 入力不正、認可失敗、未検出または競合の場合
 */
const moveTask = async (
  projectId: number,
  taskId: number,
  payload: TaskMoveRequest
): Promise<TaskBoard> => {
  const response = await HttpClient.putRequest(
    `${API_PATHS.PROJECTS}/${projectId}/tasks/${taskId}/position`,
    payload
  );
  await ensureSuccess(response);
  return (await response.json()) as TaskBoard;
};

/**
 * 楽観ロックversion付きでTaskの列以外の項目を更新する。
 * 列変更はTask移動APIが担当するため、このRequestにはtaskStatusIdを含めない。
 *
 * @param projectId 所属Project ID
 * @param taskId 更新対象Task ID
 * @param payload Task入力値と更新前version
 * @returns 更新後のTask詳細
 * @throws ProjectTaskApiError 入力不正、認可失敗、未検出または競合の場合
 */
const updateTask = async (
  projectId: number,
  taskId: number,
  payload: TaskUpdateRequest
): Promise<TaskDetail> => {
  const response = await HttpClient.putRequest(
    `${API_PATHS.PROJECTS}/${projectId}/tasks/${taskId}`,
    payload
  );
  await ensureSuccess(response);
  return (await response.json()) as TaskDetail;
};

export default {
  createTask,
  getTask,
  moveTask,
  updateTask,
};
