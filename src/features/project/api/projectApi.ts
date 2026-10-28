import type {
  ProjectCreateRequest,
  ProjectDetail,
  ProjectListResponse,
  ProjectMemberCandidate,
  ProjectMemberCreateRequest,
  ProjectMemberUpdateRequest,
  ProjectSummary,
  ProjectUpdateRequest,
  TaskBoard,
} from "@/features/project/types/project";
import HttpClient from "@/shared/api/httpClient";
import { API_PATHS } from "@/shared/constants/api";
import type { ErrorResponse } from "@/shared/types/error";
import { ensureApiSuccess } from "@/shared/utils/apiError";

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

/**
 * Project詳細Responseの参加者に、表示名（`displayName`）・状態（`accountStatus`）がない場合の既定値を補う。
 *
 * 2つの項目はBackendの「Project詳細の参加者に表示名とアカウント状態を返す」変更で追加された。
 * Frontendだけ先に反映された環境でも、担当者の選択肢（ACTIVEだけを出す）が空にならず、名前の代わりにIDが出るようにする。
 * Backendが常に返すようになれば、この補完は値を変えない。
 *
 * @param detail BackendのProject詳細Response
 * @returns 参加者の表示名と状態を必ず持つProject詳細
 */
const normalizeProjectDetail = (detail: ProjectDetail): ProjectDetail => ({
  ...detail,
  members: (detail.members ?? []).map((member) => ({
    ...member,
    displayName: member.displayName || `アカウントID: ${member.accountId}`,
    accountStatus: member.accountStatus ?? "ACTIVE",
  })),
});

/**
 * Board取得ResponseのTask cardに種別（`taskType`）がない場合、`TASK`で補う。
 *
 * この項目はBackendの「Board Task cardにTask種別を返す」変更で追加された。Frontendだけ先に反映された環境でも、
 * 従来どおりすべてのTaskでTimer・日別実績の入口を出せるようにする。Backendが常に返すようになれば、この補完は値を変えない。
 *
 * @param board BackendのBoard取得Response
 * @returns すべてのTask cardが種別を持つBoard
 */
const normalizeTaskBoard = (board: TaskBoard): TaskBoard => ({
  ...board,
  columns: board.columns.map((column) => ({
    ...column,
    tasks: column.tasks.map((task) => ({ ...task, taskType: task.taskType ?? "TASK" })),
  })),
});

/** 非2xx ResponseをProjectApiErrorへ変換する。 */
const ensureSuccess = (response: Response): Promise<void> =>
  ensureApiSuccess(
    response,
    (status, errorResponse) => new ProjectApiError(status, errorResponse)
  );

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
  return normalizeProjectDetail((await response.json()) as ProjectDetail);
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
  return normalizeTaskBoard((await response.json()) as TaskBoard);
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
  return normalizeProjectDetail((await response.json()) as ProjectDetail);
};

/**
 * Templateを使わずにProjectを作る（改善提案 2-13）。作成者はOWNERになり、標準のBoard列はBackendが作る。
 *
 * @param request Projectキー・名前・説明
 * @returns 作成したProject詳細
 * @throws ProjectApiError 入力不正（400）、Projectキー重複（409 `PROJECT_KEY_CONFLICT`）、permission不足の場合
 */
const createProject = async (request: ProjectCreateRequest): Promise<ProjectDetail> => {
  const response = await HttpClient.postRequest(API_PATHS.PROJECTS, request);
  await ensureSuccess(response);
  return normalizeProjectDetail((await response.json()) as ProjectDetail);
};

/**
 * Project memberへ追加できるアカウント候補を、名前・メールアドレス・ログインIDの前方一致で探す（改善提案 2-9）。
 * Backendは有効でまだ参加していないアカウントを最大20件、アカウントID順に返す。空白だけの語は空配列。
 *
 * @param projectId 追加先Project ID
 * @param query 検索する語
 * @returns 候補。該当がない場合は空配列
 * @throws ProjectApiError 未認証、permission・Project role不足（OWNER以外）、Project未検出の場合
 */
const findMemberCandidates = async (
  projectId: number,
  query: string
): Promise<ProjectMemberCandidate[]> => {
  const params = new URLSearchParams({ query });
  const response = await HttpClient.getRequest(
    `${API_PATHS.PROJECTS}/${projectId}/member-candidates?${params.toString()}`
  );
  await ensureSuccess(response);
  return ((await response.json()) as { candidates: ProjectMemberCandidate[] }).candidates;
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
  return normalizeProjectDetail((await response.json()) as ProjectDetail);
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
  return normalizeProjectDetail((await response.json()) as ProjectDetail);
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
  createProject,
  findMemberCandidates,
  getProject,
  getProjects,
  getTaskBoard,
  removeProjectMember,
  updateProject,
  updateProjectMember,
};
