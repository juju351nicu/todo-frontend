import { WbsApiError } from "@/features/wbs/api/wbsApi";
import { DISPLAY_MESSAGES } from "@/shared/constants/displayMessages";
import { resolveApiErrorMessages } from "@/shared/utils/apiError";

/**
 * WBS APIでFrontendが表示契約を持つerror code集合。
 * 共通Bean Validation、WBS業務例外、未検出、帳票生成失敗を含む。
 */
const WBS_ERROR_CODES: ReadonlySet<string> = new Set([
  "INVALID_REQUEST_BODY",
  "PROJECT_NOT_FOUND",
  "TASK_NOT_FOUND",
  "TASK_DEPENDENCY_NOT_FOUND",
  "TASK_WORK_LOG_NOT_FOUND",
  "TASK_EFFORT_PLAN_NOT_FOUND",
  "WORKING_DAY_NOT_FOUND",
  "WBS_BASELINE_NOT_FOUND",
  "INVALID_TASK_WORK_LOG",
  "INVALID_TASK_EFFORT_PLAN",
  "INVALID_HUMAN_ESTIMATE",
  "INVALID_TASK_WORKLOAD",
  "INVALID_WORKING_CALENDAR",
  "INVALID_WORKING_CALENDAR_RANGE",
  "INVALID_WORKING_DAY",
  "INVALID_TASK_DEPENDENCY",
  "INVALID_WBS_HIERARCHY",
  "INVALID_WBS_PLAN",
  "INVALID_WBS_ACTUAL_PERIOD",
  "WBS_BASELINE_EMPTY",
  "WBS_BASELINE_INVALID_PLAN",
  "WBS_EVM_STATUS_DATE_REQUIRED",
  "WBS_EVM_STATUS_DATE_BEFORE_BASELINE",
  "PROJECT_ARCHIVED",
  "TASK_ARCHIVED",
  "TASK_VERSION_CONFLICT",
  "TASK_DEPENDENCY_ALREADY_EXISTS",
  "TASK_DEPENDENCY_VERSION_CONFLICT",
  "TASK_WORK_LOG_ALREADY_EXISTS",
  "TASK_WORK_LOG_VERSION_CONFLICT",
  "TASK_EFFORT_PLAN_ALREADY_EXISTS",
  "TASK_EFFORT_PLAN_VERSION_CONFLICT",
  "TASK_ESTIMATE_REVISION_CONFLICT",
  "WORKING_DAY_ALREADY_EXISTS",
  "WORKING_DAY_VERSION_CONFLICT",
  "WBS_BASELINE_CREATE_CONFLICT",
  "WBS_BASELINE_VERSION_CONFLICT",
  "WBS_EVM_ACTIVE_BASELINE_REQUIRED",
  "WBS_REPORT_ROW_LIMIT_EXCEEDED",
  "WBS_REPORT_GENERATION_FAILED",
]);

/** 409回復中に古い競合案内より優先する認証・認可・公開範囲のHTTP status。 */
export { API_RECOVERY_PRIORITY_STATUSES as WBS_RECOVERY_PRIORITY_STATUSES } from "@/shared/utils/apiError";

/**
 * WBS APIのエラーResponseから、`WBS_ERROR_CODES`に含まれるcodeのBackend messageだけを表示用に取り出す。
 * 未知codeや項目エラーなしの場合は、Backend本文を表示せず固定案内へ閉じる。
 *
 * @param error WBS APIが返した非2xx Response
 * @param fallbackMessage 契約済みmessageがない場合に表示する案内
 * @returns Backendの項目エラー順のmessage。該当がなければ`fallbackMessage`だけの配列
 */
export const resolveWbsErrorMessages = (error: WbsApiError, fallbackMessage: string): string[] =>
  resolveApiErrorMessages(error.errorResponse, WBS_ERROR_CODES, fallbackMessage);

/**
 * `resolveWbsStandardErrorMessages`へ渡す、HTTP statusごとの表示message。
 * 401は画面全体のSession失効処理、接続失敗は共通の接続失敗messageで扱うため含めない。
 */
export interface WbsStandardErrorMessages {
  /** 403（permission不足）で表示する固定message。 */
  forbidden: string;
  /** 404（Projectや対象が見つからない、または未参加）で表示する固定message。 */
  notFound: string;
  /**
   * 409で表示する既定message。Backendの契約済みmessageがあればそちらを優先する。
   * 省略した場合、409はその他のstatusと同じく`failed`で扱う。
   */
  conflict?: string;
  /** その他のstatus（400、500等）で表示する既定message。Backendの契約済みmessageがあればそちらを優先する。 */
  failed: string;
}

/**
 * WBS APIの失敗を、401（Session失効処理が必要）か、画面へ表示するmessageのどちらかに分類した結果。
 */
export type WbsStandardErrorResult =
  { type: "unauthorized" } | { type: "messages"; messages: string[] };

/**
 * 回復処理（Dialogを閉じる、再取得する等）を伴わない標準的なWBS APIの失敗を、表示messageへ変換する。
 *
 * 判定順は「接続失敗 → 401 → 403 → 404 → 409 → その他」で、各領域の参照APIとTask更新APIで共通である。
 * 409で競合回復を行う等、領域固有の手順がある処理では使わず、statusを個別に判定する。
 *
 * @param error API呼出しで発生した例外。`WbsApiError`以外は接続失敗として扱う
 * @param messages statusごとの表示message
 * @returns 401なら`unauthorized`（呼出側が`WbsPageContext.handleUnauthorized`を呼ぶ）、それ以外は表示するmessage
 */
export const resolveWbsStandardErrorMessages = (
  error: unknown,
  messages: Readonly<WbsStandardErrorMessages>
): WbsStandardErrorResult => {
  if (!(error instanceof WbsApiError)) {
    return { type: "messages", messages: [DISPLAY_MESSAGES.common.connectionFailed] };
  }
  if (error.status === 401) {
    return { type: "unauthorized" };
  }
  if (error.status === 403) {
    return { type: "messages", messages: [messages.forbidden] };
  }
  if (error.status === 404) {
    return { type: "messages", messages: [messages.notFound] };
  }
  if (error.status === 409 && messages.conflict !== undefined) {
    return { type: "messages", messages: resolveWbsErrorMessages(error, messages.conflict) };
  }
  return { type: "messages", messages: resolveWbsErrorMessages(error, messages.failed) };
};
