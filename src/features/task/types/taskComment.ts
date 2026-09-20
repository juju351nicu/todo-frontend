/** BackendのTaskコメント一覧・投稿・編集Response。 */
export interface TaskComment {
  commentId: number;
  taskId: number;
  authorAccountId: number;
  authorDisplayName: string;
  body: string;
  createdAt: string;
  updatedAt: string;
  /** 編集・削除Requestへ渡す取得時点の楽観ロックversion。 */
  version: number;
}

/** Taskコメント投稿Request。`@loginId`形式のメンションを本文へ含められる。 */
export interface TaskCommentCreateRequest {
  body: string;
}

/** Taskコメント編集Request。本文と一覧取得時点のversionを送る。 */
export interface TaskCommentUpdateRequest {
  body: string;
  version: number;
}
