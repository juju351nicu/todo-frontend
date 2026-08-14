import type {
  ProjectDetail,
  ProjectListResponse,
  ProjectMemberCreateRequest,
  ProjectMemberUpdateRequest,
  ProjectSummary,
  ProjectUpdateRequest,
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

/**
 * Projectの表示情報または状態を楽観ロック付きで更新する。
 *
 * @param projectId 更新対象Project ID
 * @param request 表示情報、更新後状態、詳細取得時点のversion
 * @returns 更新確定後のProject詳細
 * @throws ProjectApiError permission・Project role不足、archive状態またはversion競合の場合
 */
const updateProject = async (
  projectId: number,
  request: ProjectUpdateRequest
): Promise<ProjectDetail> => {
  const response = await HttpClient.putRequest(
    `${API_PATHS.PROJECTS}/${projectId}`,
    request
  );
  await ensureSuccess(response);
  return (await response.json()) as ProjectDetail;
};

/**
 * 有効なアカウントをProject memberとして追加する。
 *
 * @param projectId 追加先Project ID
 * @param request 追加するアカウントIDとProject role
 * @returns member追加後のProject詳細
 * @throws ProjectApiError 未登録・無効・参加済みアカウント、permission不足の場合
 */
const addProjectMember = async (
  projectId: number,
  request: ProjectMemberCreateRequest
): Promise<ProjectDetail> => {
  const response = await HttpClient.postRequest(
    `${API_PATHS.PROJECTS}/${projectId}/members`,
    request
  );
  await ensureSuccess(response);
  return (await response.json()) as ProjectDetail;
};

/**
 * Project memberのroleを楽観ロック付きで変更する。
 *
 * @param projectId 対象Project ID
 * @param accountId role変更対象アカウントID
 * @param request 更新後roleと詳細取得時点のmember version
 * @returns role変更後のProject詳細
 * @throws ProjectApiError 最後のOWNER、permission不足またはversion競合の場合
 */
const updateProjectMember = async (
  projectId: number,
  accountId: number,
  request: ProjectMemberUpdateRequest
): Promise<ProjectDetail> => {
  const response = await HttpClient.putRequest(
    `${API_PATHS.PROJECTS}/${projectId}/members/${accountId}`,
    request
  );
  await ensureSuccess(response);
  return (await response.json()) as ProjectDetail;
};

/**
 * Project memberをversion条件付きで除外する。
 *
 * @param projectId 対象Project ID
 * @param accountId 除外対象アカウントID
 * @param version 詳細取得時点のmember version
 * @returns 204成功時に解決するPromise
 * @throws ProjectApiError 最後のOWNER、permission不足またはversion競合の場合
 */
const removeProjectMember = async (
  projectId: number,
  accountId: number,
  version: number
): Promise<void> => {
  const response = await HttpClient.deleteRequest(
    `${API_PATHS.PROJECTS}/${projectId}/members/${accountId}?version=${version}`
  );
  await ensureSuccess(response);
};

export default {
  addProjectMember,
  getProject,
  getProjects,
  getTaskBoard,
  removeProjectMember,
  updateProject,
  updateProjectMember,
};
