import type { AccountStatus } from "@/shared/types/accountStatus";

/** BackendのTaskコメント一覧・投稿・編集Response。 */
export interface TaskComment {
  commentId: number;
  taskId: number;
  authorAccountId: number;
  authorDisplayName: string;
  /**
   * 投稿者の現在のアカウント状態（`account.status`）。無効化された投稿者のコメントも会話の履歴として一覧に残るため、
   * 画面はACTIVE以外のときに状態の印を添える。Backendが返さない古い版では`taskCommentApi`がACTIVEで補う。
   */
  authorAccountStatus: AccountStatus;
  body: string;
  createdAt: string;
  updatedAt: string;
  /** 編集・削除Requestへ渡す取得時点の楽観ロックversion。 */
  version: number;
}

/** Project内のTaskコメント一覧Response。Taskの現在情報をコメントへ付加する。 */
export interface ProjectTaskComment extends TaskComment {
  /** コメント対象Taskの現在のタイトル。 */
  taskTitle: string;
  /** コメント対象TaskがBoardからarchive済みの場合true。 */
  taskArchived: boolean;
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
