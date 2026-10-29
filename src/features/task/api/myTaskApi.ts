import type { MyTaskListResponse } from "@/features/task/types/myTask";
import HttpClient from "@/shared/api/httpClient";
import { API_PATHS } from "@/shared/constants/api";
import type { ErrorResponse } from "@/shared/types/error";
import { ApiError, ensureApiSuccess } from "@/shared/utils/apiError";

/** My Tasks API（本人担当のProject Taskの一覧・完了）のHTTPエラーをstatusとBackendエラー本文付きで表す。 */
export class MyTaskApiError extends ApiError {
  constructor(status: number, errorResponse: ErrorResponse | null) {
    super("MyTaskApiError", "My Tasks API", status, errorResponse);
  }
}

/** 非2xx ResponseをMyTaskApiErrorへ変換する。 */
const ensureSuccess = (response: Response): Promise<void> =>
  ensureApiSuccess(response, (status, errorResponse) => new MyTaskApiError(status, errorResponse));

/**
 * 認証利用者本人が担当する未完了Project Taskを取得する。
 *
 * @returns Backendが本人・Project・状態・期限を確定したMy Tasks Response
 * @throws MyTaskApiError 未認証、参照permission不足またはBackendエラーの場合
 */
const findMyTasks = async (): Promise<MyTaskListResponse> => {
  const response = await HttpClient.getRequest(API_PATHS.MY_TASKS);
  await ensureSuccess(response);
  return (await response.json()) as MyTaskListResponse;
};

/**
 * My Tasksの「完了」で、Project Taskを完了扱いのBoard列の末尾へ移して完了にする
 * （`POST /api/v1/projects/{projectId}/tasks/{taskId}/complete`）。
 * Board列の移動と同じ採番・version・Project状態の検査を使い、担当者本人のMEMBERも完了にできる（TASK_UPDATE）。
 * 共通HTTP clientがSession CookieとCSRF tokenを付ける。
 *
 * @param projectId Taskが属するProject ID
 * @param taskId    完了にするTask ID
 * @param version   My Tasksで取得した時点のTaskのversion
 * @throws MyTaskApiError 401・403・404、409（version競合 `TASK_VERSION_CONFLICT`、archive済みProject `PROJECT_ARCHIVED`、
 *   Summary Task `SUMMARY_TASK_NOT_COMPLETABLE`等）の場合
 */
const completeMyTask = async (
  projectId: number,
  taskId: number,
  version: number
): Promise<void> => {
  const response = await HttpClient.postRequest(
    `${API_PATHS.PROJECTS}/${projectId}/tasks/${taskId}/complete`,
    { version }
  );
  await ensureSuccess(response);
};

export default {
  completeMyTask,
  findMyTasks,
};
