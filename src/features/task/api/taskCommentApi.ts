import type {
  ProjectTaskComment,
  TaskComment,
  TaskCommentCreateRequest,
  TaskCommentUpdateRequest,
} from "@/features/task/types/taskComment";
import HttpClient from "@/shared/api/httpClient";
import { API_PATHS } from "@/shared/constants/api";
import type { ErrorResponse } from "@/shared/types/error";
import { ensureApiSuccess } from "@/shared/utils/apiError";

/** TaskコメントAPIのHTTPエラーをstatusとBackendエラー本文付きで表す。 */
export class TaskCommentApiError extends Error {
  readonly status: number;

  readonly errorResponse: ErrorResponse | null;

  constructor(status: number, errorResponse: ErrorResponse | null) {
    super(`TaskコメントAPIの実行に失敗しました。status=${status}`);
    this.name = "TaskCommentApiError";
    this.status = status;
    this.errorResponse = errorResponse;
  }
}

/** TaskコメントAPIのProject・Task階層pathを組み立てる。 */
const createPath = (projectId: number, taskId: number): string =>
  `${API_PATHS.PROJECTS}/${projectId}/tasks/${taskId}/comments`;

/** Project内のTaskコメント一覧pathを組み立てる。 */
const createProjectPath = (projectId: number): string =>
  `${API_PATHS.PROJECTS}/${projectId}/comments`;

/** 非2xx ResponseをTaskCommentApiErrorへ変換する。 */
const ensureSuccess = (response: Response): Promise<void> =>
  ensureApiSuccess(
    response,
    (status, errorResponse) => new TaskCommentApiError(status, errorResponse)
  );

/**
 * コメントResponseに投稿者の状態（`authorAccountStatus`）がない場合、ACTIVEで補う。
 *
 * この項目はBackendの「無効化された投稿者のコメントも一覧に残す」変更で追加された。
 * Frontendだけ先に反映された環境でも、すべての投稿者を従来どおり有効として表示できるようにする。
 * Backendが常に返すようになれば、この補完は値を変えない。
 *
 * @param comment BackendのコメントResponse
 * @returns 投稿者の状態を必ず持つコメント
 */
const normalizeComment = <T extends TaskComment>(comment: T): T => ({
  ...comment,
  authorAccountStatus: comment.authorAccountStatus ?? "ACTIVE",
});

/**
 * Taskのコメント一覧を投稿時刻順で取得する。
 *
 * @param projectId 所属Project ID
 * @param taskId 対象Task ID
 * @returns 認可済みコメント一覧
 * @throws TaskCommentApiError 未認証、参照不可またはBackendエラーの場合
 */
const findComments = async (
  projectId: number,
  taskId: number
): Promise<TaskComment[]> => {
  const response = await HttpClient.getRequest(createPath(projectId, taskId));
  await ensureSuccess(response);
  return ((await response.json()) as TaskComment[]).map(normalizeComment);
};

/**
 * Project内の最新TaskコメントをTask情報付きで取得する。
 *
 * @param projectId 参照対象Project ID
 * @returns archive済みTaskを含む、最終更新時刻の新しい順の最新100件
 * @throws TaskCommentApiError 未認証、参照不可またはBackendエラーの場合
 */
const findProjectComments = async (
  projectId: number
): Promise<ProjectTaskComment[]> => {
  const response = await HttpClient.getRequest(createProjectPath(projectId));
  await ensureSuccess(response);
  return ((await response.json()) as ProjectTaskComment[]).map(normalizeComment);
};

/**
 * Taskへコメントを投稿する。更新系RequestのCSRF処理は共通HttpClientへ委譲する。
 *
 * @param projectId 所属Project ID
 * @param taskId 対象Task ID
 * @param payload 本文と`@loginId`形式のメンション
 * @returns 登録済みコメント
 * @throws TaskCommentApiError 入力不正、認可失敗またはBackendエラーの場合
 */
const createComment = async (
  projectId: number,
  taskId: number,
  payload: TaskCommentCreateRequest
): Promise<TaskComment> => {
  const response = await HttpClient.postRequest(
    createPath(projectId, taskId),
    payload
  );
  await ensureSuccess(response);
  return normalizeComment((await response.json()) as TaskComment);
};

/**
 * 投稿者本人のTaskコメントを取得時点version付きで編集する。
 *
 * @param projectId 所属Project ID
 * @param taskId 対象Task ID
 * @param commentId 編集対象コメントID
 * @param payload 更新後本文と取得時点version
 * @returns 更新済みコメント
 * @throws TaskCommentApiError 投稿者不一致、未検出、version競合またはBackendエラーの場合
 */
const updateComment = async (
  projectId: number,
  taskId: number,
  commentId: number,
  payload: TaskCommentUpdateRequest
): Promise<TaskComment> => {
  const response = await HttpClient.putRequest(
    `${createPath(projectId, taskId)}/${commentId}`,
    payload
  );
  await ensureSuccess(response);
  return normalizeComment((await response.json()) as TaskComment);
};

/**
 * 投稿者本人のTaskコメントを取得時点version付きで削除する。
 *
 * @param projectId 所属Project ID
 * @param taskId 対象Task ID
 * @param commentId 削除対象コメントID
 * @param version 一覧取得時点のversion
 * @throws TaskCommentApiError 投稿者不一致、未検出、version競合またはBackendエラーの場合
 */
const deleteComment = async (
  projectId: number,
  taskId: number,
  commentId: number,
  version: number
): Promise<void> => {
  const query = new URLSearchParams({ version: String(version) });
  const response = await HttpClient.deleteRequest(
    `${createPath(projectId, taskId)}/${commentId}?${query}`
  );
  await ensureSuccess(response);
};

export default {
  createComment,
  deleteComment,
  findComments,
  findProjectComments,
  updateComment,
};

export type { TaskComment };
