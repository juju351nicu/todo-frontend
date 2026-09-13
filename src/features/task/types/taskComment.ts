/** BackendのTaskコメント一覧・投稿Response。 */
export interface TaskComment {
  commentId: number;
  taskId: number;
  authorAccountId: number;
  authorDisplayName: string;
  body: string;
  createdAt: string;
  updatedAt: string;
}

/** Taskコメント投稿Request。`@loginId`形式のメンションを本文へ含められる。 */
export interface TaskCommentCreateRequest {
  body: string;
}
