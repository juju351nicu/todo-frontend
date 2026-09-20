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

/** 繰り返しTask APIのHTTPエラーをstatusとBackendエラー本文付きで表す。 */
export class TaskRecurrenceApiError extends Error {
  readonly status: number;

  readonly errorResponse: ErrorResponse | null;

  constructor(status: number, errorResponse: ErrorResponse | null) {
    super(`繰り返しTask APIの実行に失敗しました。status=${status}`);
    this.name = "TaskRecurrenceApiError";
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

/** 非2xx ResponseをTaskRecurrenceApiErrorへ変換する。 */
const ensureSuccess = async (response: Response): Promise<void> => {
  if (!response.ok) {
    throw new TaskRecurrenceApiError(
      response.status,
      await readErrorResponse(response)
    );
  }
};

/** Project配下の繰り返し規則API pathを組み立てる。 */
const recurrencePath = (projectId: number): string =>
  `${API_PATHS.PROJECTS}/${projectId}/task-recurrences`;

/** 参照可能なProjectのarchive済みを含む繰り返し規則を取得する。 */
const findRules = async (projectId: number): Promise<TaskRecurrence[]> => {
  const response = await HttpClient.getRequest(recurrencePath(projectId));
  await ensureSuccess(response);
  return (await response.json()) as TaskRecurrence[];
};

/** Task snapshotとscheduleから繰り返し規則を直接作成する。 */
const create = async (
  projectId: number,
  payload: TaskRecurrenceCreateRequest
): Promise<TaskRecurrence> => {
  const response = await HttpClient.postRequest(
    recurrencePath(projectId),
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
    `${recurrencePath(projectId)}/from-template`,
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
    `${recurrencePath(projectId)}/${taskRecurrenceRuleId}`,
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
    `${recurrencePath(projectId)}/${taskRecurrenceRuleId}?${query}`
  );
  await ensureSuccess(response);
};

/** 指定規則の直近100件の生成履歴を取得する。 */
const findGenerations = async (
  projectId: number,
  taskRecurrenceRuleId: number
): Promise<TaskRecurrenceGeneration[]> => {
  const response = await HttpClient.getRequest(
    `${recurrencePath(projectId)}/${taskRecurrenceRuleId}/generations`
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
    `${recurrencePath(projectId)}/${taskRecurrenceRuleId}/generations/${taskRecurrenceGenerationId}/retry`,
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
