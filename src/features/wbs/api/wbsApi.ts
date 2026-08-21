import type {
  TaskDependencyCreateRequest,
  TaskDependencyListResponse,
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
  const payload = (await response.json()) as WbsResponse;
  return {
    ...payload,
    // 古いfixtureやTask未登録Responseでも、画面側へundefinedを伝播させない。
    tasks: payload.tasks ?? [],
  };
};

/**
 * 既存TaskのWBS固有項目を楽観ロック付きで更新する。
 *
 * @param projectId 更新対象Taskが所属するProject ID
 * @param taskId 更新対象Task ID
 * @param request 階層、種別、予定、進捗と取得時点のversion
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
  const payload = (await response.json()) as WbsResponse;
  return {
    ...payload,
    tasks: payload.tasks ?? [],
  };
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

export default {
  createTaskDependency,
  deleteTaskDependency,
  getTaskDependencies,
  getWbs,
  updateWbsTask,
};
