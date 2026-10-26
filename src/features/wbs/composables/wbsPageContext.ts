import type { ComputedRef, Ref } from "vue";

import type { ProjectDetail } from "@/features/project/types/project";
import type { WbsResponse, WbsTreeRow } from "@/features/wbs/types/wbs";

/**
 * `useWbsPage`が領域別composable（workload、稼働日calendar、日別予定・実績、依存関係、baseline、EVM、Excel帳票）へ渡す画面共通の状態と操作。
 *
 * - 状態の正本は`useWbsPage`が持ち、領域別composableは参照または契約で許された範囲だけを更新する。
 * - 領域をまたぐ再取得（例: 日別予定保存後のworkload再取得）はこのcontextではなく、各composableのoptionsのcallbackで受け渡す。
 * - 401時のSession破棄とLogin遷移は`handleUnauthorized`へ集約し、各領域はDialogを閉じてから呼び出す。
 */
export interface WbsPageContext {
  /** route paramから検証したProject ID。正の安全な整数でない場合はnullで、各領域はAPIを呼ばない。 */
  readonly projectId: ComputedRef<number | null>;
  /** Project member・状態の最新取得結果。権限判定と担当者候補に使う。未取得・取得失敗時はnull。 */
  readonly project: Ref<ProjectDetail | null>;
  /** WBS APIの最新Response。Boardと同じTaskを正本とし、未取得・取得失敗時はnull。 */
  readonly wbs: Ref<WbsResponse | null>;
  /** `wbs`のTaskを親の直後に子孫が続く順へ並べた階層表の行。 */
  readonly rows: ComputedRef<WbsTreeRow[]>;
  /** TASK_UPDATE permissionを持ち、WBS・依存関係・日別予定実績等を更新できるか。 */
  readonly canEditWbs: ComputedRef<boolean>;
  /** SYSTEM_ADMIN、またはProjectのOWNER・MANAGERとして他memberの予定・実績・calendarも管理できるか。 */
  readonly canManageProject: ComputedRef<boolean>;
  /** 画面上部に表示するWBS全体のエラー。Dialog外の操作の失敗理由もここへ表示する。 */
  readonly errorMessages: Ref<string[]>;
  /** 画面上部に表示するWBS全体の成功message。 */
  readonly successMessage: Ref<string>;
  /**
   * 401受信時にSessionを破棄し、全領域のAPIエラーを消してLoginへ遷移する。
   * 呼出側は古いversionを残さないよう、先に自領域のDialogと確認対象を閉じる。
   */
  readonly handleUnauthorized: () => Promise<void>;
  /**
   * この画面で401を受信済みか。
   * 並行中の再取得が完了したときに、Login遷移後の画面へ古い競合案内を復元しないために参照する。
   */
  readonly isSessionInvalidated: () => boolean;
}
