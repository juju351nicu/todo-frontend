import type {
  TaskTemplate,
  TaskTemplateApplyRequest,
  TaskTemplateApplyResponse,
  TaskTemplateCaptureRequest,
  TaskTemplateUpdateRequest,
} from "@/features/task/types/taskTemplate";
import HttpClient from "@/shared/api/httpClient";
import { API_PATHS } from "@/shared/constants/api";
import type { ErrorResponse } from "@/shared/types/error";

/** Task Template APIのHTTPエラーをstatusとBackendエラー本文付きで表す。 */
export class TaskTemplateApiError extends Error {
  readonly status: number;

  readonly errorResponse: ErrorResponse | null;

  constructor(status: number, errorResponse: ErrorResponse | null) {
    super(`Task Template APIの実行に失敗しました。status=${status}`);
    this.name = "TaskTemplateApiError";
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

/** 非2xx ResponseをTaskTemplateApiErrorへ変換する。 */
const ensureSuccess = async (response: Response): Promise<void> => {
  if (!response.ok) {
    throw new TaskTemplateApiError(
      response.status,
      await readErrorResponse(response)
    );
  }
};

/** 認証中の本人が所有するactive Task Templateを取得する。 */
const findOwnTemplates = async (): Promise<TaskTemplate[]> => {
  const response = await HttpClient.getRequest(API_PATHS.TASK_TEMPLATES);
  await ensureSuccess(response);
  return (await response.json()) as TaskTemplate[];
};

/** 既存Taskと未完了checklistを本人用Templateへsnapshotする。 */
const capture = async (
  projectId: number,
  taskId: number,
  payload: TaskTemplateCaptureRequest
): Promise<TaskTemplate> => {
  const response = await HttpClient.postRequest(
    `${API_PATHS.PROJECTS}/${projectId}/tasks/${taskId}/templates`,
    payload
  );
  await ensureSuccess(response);
  return (await response.json()) as TaskTemplate;
};

/** 本人所有TemplateのTask初期値とchecklist snapshotを全置換する。 */
const update = async (
  taskTemplateId: number,
  payload: TaskTemplateUpdateRequest
): Promise<TaskTemplate> => {
  const response = await HttpClient.putRequest(
    `${API_PATHS.TASK_TEMPLATES}/${taskTemplateId}`,
    payload
  );
  await ensureSuccess(response);
  return (await response.json()) as TaskTemplate;
};

/** 本人所有Templateを取得時点version付きでarchiveする。 */
const archive = async (
  taskTemplateId: number,
  version: number
): Promise<void> => {
  const query = new URLSearchParams({ version: String(version) });
  const response = await HttpClient.deleteRequest(
    `${API_PATHS.TASK_TEMPLATES}/${taskTemplateId}?${query}`
  );
  await ensureSuccess(response);
};

/** Template snapshotから対象Projectへ通常Taskを生成する。 */
const apply = async (
  projectId: number,
  payload: TaskTemplateApplyRequest
): Promise<TaskTemplateApplyResponse> => {
  const response = await HttpClient.postRequest(
    `${API_PATHS.PROJECTS}/${projectId}/tasks/from-template`,
    payload
  );
  await ensureSuccess(response);
  return (await response.json()) as TaskTemplateApplyResponse;
};

export default {
  apply,
  archive,
  capture,
  findOwnTemplates,
  update,
};
