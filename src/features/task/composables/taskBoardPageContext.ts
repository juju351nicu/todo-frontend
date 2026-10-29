import type { ComputedRef, Ref } from "vue";

import type { ProjectApiError } from "@/features/project/api/projectApi";
import type { ProjectDetail, TaskBoard } from "@/features/project/types/project";
import type { ProjectTaskApiError } from "@/features/task/api/projectTaskApi";

/** Board画面で扱うProject・Task APIの例外。 */
export type TaskBoardApiError = ProjectApiError | ProjectTaskApiError;

/**
 * `useTaskBoardPage`が領域別composable（Task Dialog、Taskの移動）へ渡す、画面共通の状態と操作。
 *
 * - 状態の正本は`useTaskBoardPage`が持ち、領域別composableは参照または契約で許された範囲だけを更新する。
 * - APIエラーの表示、401のSession破棄、403・404で古い画面を捨てる処理は`handleApiError`等へ集約する。
 *   各領域は失敗を受けたら呼ぶだけでよい。
 */
export interface TaskBoardPageContext {
  /** route paramから検証したProject ID。正の安全な整数でない場合はnullで、各領域はAPIを呼ばない。 */
  readonly projectId: ComputedRef<number | null>;
  /** Project詳細（参加者・Board列・状態）の最新取得結果。未取得・取得失敗時はnull。 */
  readonly project: Ref<ProjectDetail | null>;
  /** Boardの最新取得結果。移動中は楽観表示を含む。未取得・取得失敗時はnull。 */
  readonly board: Ref<TaskBoard | null>;
  /** 画面上部に表示するエラー。Dialogを開いている間の操作の失敗は、Dialog側のmessageへ出す。 */
  readonly errorMessages: Ref<string[]>;
  /** 画面上部に表示する成功message。 */
  readonly successMessage: Ref<string>;
  /** Project詳細とBoardを同じ画面スナップショットとして取り直す。失敗は呼出側へ投げる。 */
  readonly loadBoardData: () => Promise<void>;
  /**
   * Project・Task APIの失敗を画面の表示へ変換する（401はSessionを破棄してLoginへ戻す）。
   *
   * @param error APIの失敗
   * @param fallbackMessage 契約済みcodeがない場合のmessage
   * @param forbiddenMessage 403のmessage。省略時は操作権限がない旨
   * @param messageTarget messageの表示先。省略時は画面上部（`errorMessages`）
   */
  readonly handleApiError: (
    error: unknown,
    fallbackMessage: string,
    forbiddenMessage?: string,
    messageTarget?: Ref<string[]>
  ) => Promise<void>;
  /** 確定済みのTask操作の後のBoard再取得の失敗を、操作の失敗と区別して表示する。 */
  readonly handleConfirmedBoardRefreshError: (error: unknown, fallbackMessage: string) => Promise<void>;
  /** 409競合の後に最新Boardを取り直し、取り直し済みであることを案内に添える。 */
  readonly reloadBoardAfterConflict: () => Promise<void>;
}
