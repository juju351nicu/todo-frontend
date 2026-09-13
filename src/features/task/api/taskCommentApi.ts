import type {
  TaskComment,
  TaskCommentCreateRequest,
} from "@/features/task/types/taskComment";
import HttpClient from "@/shared/api/httpClient";
import { API_PATHS } from "@/shared/constants/api";

/** TaskコメントAPIのProject・Task階層pathを組み立てる。 */
const createPath = (projectId: number, taskId: number): string =>
  `${API_PATHS.PROJECTS}/${projectId}/tasks/${taskId}/comments`;

/**
 * Taskのコメント一覧を投稿時刻順で取得する。
 *
 * @param projectId 所属Project ID
 * @param taskId 対象Task ID
 * @returns 認可済みコメント一覧を含むResponse
 */
const findComments = (
  projectId: number,
  taskId: number
): Promise<Response> => HttpClient.getRequest(createPath(projectId, taskId));

/**
 * Taskへコメントを投稿する。更新系RequestのCSRF処理は共通HttpClientへ委譲する。
 *
 * @param projectId 所属Project ID
 * @param taskId 対象Task ID
 * @param payload 本文と`@loginId`形式のメンション
 * @returns 登録済みコメントを含むResponse
 */
const createComment = (
  projectId: number,
  taskId: number,
  payload: TaskCommentCreateRequest
): Promise<Response> =>
  HttpClient.postRequest(createPath(projectId, taskId), payload);

export default {
  createComment,
  findComments,
};

export type { TaskComment };
