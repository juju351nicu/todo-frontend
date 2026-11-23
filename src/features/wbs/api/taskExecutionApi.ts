import { WbsApiError } from "@/features/wbs/api/wbsApi";
import type {
  ExecutionComparison,
  ExecutionSettingRequest,
  ExecutionSettingResponse,
} from "@/features/wbs/types/taskExecution";
import HttpClient from "@/shared/api/httpClient";
import { API_PATHS } from "@/shared/constants/api";
import { ensureApiSuccess } from "@/shared/utils/apiError";

/** 非2xxを既存WBSのstatus・code契約へ変換し、本文を直接表示しない。 */
const ensureSuccess = (response: Response): Promise<void> =>
  ensureApiSuccess(response, (status, body) => new WbsApiError(status, body));

/**
 * 同じTask・業務日期間の本人配賦と元計測を参照する。更新・provider通信は行わない。
 * @param projectId 所属Project
 * @param taskId 通常Task
 * @param dateFrom 開始業務日inclusive
 * @param dateTo 終了業務日inclusive
 * @returns 本人だけの比較根拠。配列の欠落は空へ正規化する
 * @throws WbsApiError 未認証、認可不足、対象なし、期間不正の場合
 */
export const getExecutionComparison = async (
  projectId: number,
  taskId: number,
  dateFrom: string,
  dateTo: string
): Promise<ExecutionComparison> => {
  const query = new URLSearchParams({ dateFrom, dateTo });
  const response = await HttpClient.getRequest(
    `${API_PATHS.PROJECTS}/${projectId}/wbs/tasks/${taskId}/execution-comparison?${query}`
  );
  await ensureSuccess(response);
  const payload = (await response.json()) as ExecutionComparison;
  return {
    ...payload,
    groups: payload.groups ?? [],
    days: payload.days ?? [],
    sessions: payload.sessions ?? [],
    measurements: payload.measurements ?? [],
  };
};

/**
 * 本人の停止Timerへ申告設定を一度記録する。Session・masked CSRFは共通clientで送る。
 * @param projectId 所属Project
 * @param taskId 通常Task
 * @param request 公開設定だけの入力。workerや時刻は含めない
 * @returns 保存済みsnapshot。同じ本文の再送でも受理時刻を変えない
 * @throws WbsApiError 未認証、他人・対象外Session、既存本文競合、計測の二重関連の場合
 */
export const recordExecutionSetting = async (
  projectId: number,
  taskId: number,
  request: ExecutionSettingRequest
): Promise<ExecutionSettingResponse> => {
  const response = await HttpClient.postRequest(
    `${API_PATHS.PROJECTS}/${projectId}/wbs/tasks/${taskId}/execution-settings`,
    request
  );
  await ensureSuccess(response);
  return (await response.json()) as ExecutionSettingResponse;
};
