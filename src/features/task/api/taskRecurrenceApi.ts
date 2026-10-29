import type {
  TaskRecurrence,
  TaskRecurrenceCreateRequest,
  TaskRecurrenceFromTemplateRequest,
  TaskRecurrenceGeneration,
  TaskRecurrenceUpdateRequest,
} from "@/features/task/types/taskRecurrence";
import HttpClient from "@/shared/api/httpClient";
import { API_PATHS } from "@/shared/constants/api";
import type { ErrorResponse } from "@/shared/types/error";
import { ApiError, ensureApiSuccess } from "@/shared/utils/apiError";

/** 繰り返しTask APIのHTTPエラーをstatusとBackendエラー本文付きで表す。 */
export class TaskRecurrenceApiError extends ApiError {
  constructor(status: number, errorResponse: ErrorResponse | null) {
    super("TaskRecurrenceApiError", "繰り返しTask API", status, errorResponse);
  }
}

/** 非2xx ResponseをTaskRecurrenceApiErrorへ変換する。 */
const ensureSuccess = (response: Response): Promise<void> =>
  ensureApiSuccess(
    response,
    (status, errorResponse) => new TaskRecurrenceApiError(status, errorResponse)
  );

/** Project配下の繰り返し規則API pathを組み立てる。 */
const buildRecurrencePath = (projectId: number): string =>
  `${API_PATHS.PROJECTS}/${projectId}/task-recurrences`;

/** 参照可能なProjectのarchive済みを含む繰り返し規則を取得する。 */
const findRules = async (projectId: number): Promise<TaskRecurrence[]> => {
  const response = await HttpClient.getRequest(buildRecurrencePath(projectId));
  await ensureSuccess(response);
  return (await response.json()) as TaskRecurrence[];
};

/** Task snapshotとscheduleから繰り返し規則を直接作成する。 */
const create = async (
  projectId: number,
  payload: TaskRecurrenceCreateRequest
): Promise<TaskRecurrence> => {
  const response = await HttpClient.postRequest(
    buildRecurrencePath(projectId),
    payload
  );
  await ensureSuccess(response);
  return (await response.json()) as TaskRecurrence;
};

/** 本人所有Task Templateのsnapshotから繰り返し規則を作成する。 */
const createFromTemplate = async (
  projectId: number,
  payload: TaskRecurrenceFromTemplateRequest
): Promise<TaskRecurrence> => {
  const response = await HttpClient.postRequest(
    `${buildRecurrencePath(projectId)}/from-template`,
    payload
  );
  await ensureSuccess(response);
  return (await response.json()) as TaskRecurrence;
};

/** 繰り返し規則のsnapshot、schedule、pause状態をversion付きで更新する。 */
const update = async (
  projectId: number,
  taskRecurrenceRuleId: number,
  payload: TaskRecurrenceUpdateRequest
): Promise<TaskRecurrence> => {
  const response = await HttpClient.putRequest(
    `${buildRecurrencePath(projectId)}/${taskRecurrenceRuleId}`,
    payload
  );
  await ensureSuccess(response);
  return (await response.json()) as TaskRecurrence;
};

/** 繰り返し規則を取得時点version付きでarchiveする。 */
const archive = async (
  projectId: number,
  taskRecurrenceRuleId: number,
  version: number
): Promise<void> => {
  const query = new URLSearchParams({ version: String(version) });
  const response = await HttpClient.deleteRequest(
    `${buildRecurrencePath(projectId)}/${taskRecurrenceRuleId}?${query}`
  );
  await ensureSuccess(response);
};

/** 指定規則の直近100件の生成履歴を取得する。 */
const findGenerations = async (
  projectId: number,
  taskRecurrenceRuleId: number
): Promise<TaskRecurrenceGeneration[]> => {
  const response = await HttpClient.getRequest(
    `${buildRecurrencePath(projectId)}/${taskRecurrenceRuleId}/generations`
  );
  await ensureSuccess(response);
  return (await response.json()) as TaskRecurrenceGeneration[];
};

/** FAILED生成履歴を規則version条件付きでPENDINGへ戻す。 */
const retryGeneration = async (
  projectId: number,
  taskRecurrenceRuleId: number,
  taskRecurrenceGenerationId: number,
  version: number
): Promise<TaskRecurrenceGeneration> => {
  const response = await HttpClient.postRequest(
    `${buildRecurrencePath(projectId)}/${taskRecurrenceRuleId}/generations/${taskRecurrenceGenerationId}/retry`,
    { version }
  );
  await ensureSuccess(response);
  return (await response.json()) as TaskRecurrenceGeneration;
};

export default {
  archive,
  create,
  createFromTemplate,
  findGenerations,
  findRules,
  retryGeneration,
  update,
};
