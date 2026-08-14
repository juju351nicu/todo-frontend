import type {
  ProjectDetail,
  ProjectListResponse,
  ProjectSummary,
  TaskBoard,
} from "@/features/project/types/project";
import HttpClient from "@/shared/api/httpClient";
import { API_PATHS } from "@/shared/constants/api";
import type { ErrorResponse } from "@/shared/types/error";

/** Project APIのHTTPエラーをstatusとBackendエラー本文付きで表す。 */
export class ProjectApiError extends Error {
  readonly status: number;

  readonly errorResponse: ErrorResponse | null;

  constructor(status: number, errorResponse: ErrorResponse | null) {
    super(`Project APIの実行に失敗しました。status=${status}`);
    this.name = "ProjectApiError";
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

/** 非2xx ResponseをProjectApiErrorへ変換する。 */
const ensureSuccess = async (response: Response): Promise<void> => {
  if (!response.ok) {
    throw new ProjectApiError(response.status, await readErrorResponse(response));
  }
};

/**
 * 現在のSession利用者が参照できるProjectを取得する。
 *
 * @returns Project概要。対象がない場合は空配列
 * @throws ProjectApiError 未認証、permission不足またはBackendエラーの場合
 */
const getProjects = async (): Promise<ProjectSummary[]> => {
  const response = await HttpClient.getRequest(API_PATHS.PROJECTS);
  await ensureSuccess(response);
  const payload = (await response.json()) as ProjectListResponse;
  return payload.projects ?? [];
};

/**
 * ProjectメンバーとTask statusを含むProject詳細を取得する。
 *
 * @param projectId 参照対象Project ID
 * @returns Project詳細
 * @throws ProjectApiError 未認証、参照不可または未検出の場合
 */
const getProject = async (projectId: number): Promise<ProjectDetail> => {
  const response = await HttpClient.getRequest(`${API_PATHS.PROJECTS}/${projectId}`);
  await ensureSuccess(response);
  return (await response.json()) as ProjectDetail;
};

/**
 * Projectの列とTaskカードをBoard表示用に取得する。
 *
 * @param projectId 参照対象Project ID
 * @returns position順に整列済みのBoard
 * @throws ProjectApiError 未認証、参照不可または未検出の場合
 */
const getTaskBoard = async (projectId: number): Promise<TaskBoard> => {
  const response = await HttpClient.getRequest(
    `${API_PATHS.PROJECTS}/${projectId}/board`
  );
  await ensureSuccess(response);
  return (await response.json()) as TaskBoard;
};

export default {
  getProject,
  getProjects,
  getTaskBoard,
};
