import type { WbsResponse } from "@/features/wbs/types/wbs";
import HttpClient from "@/shared/api/httpClient";
import { API_PATHS } from "@/shared/constants/api";
import type { ErrorResponse } from "@/shared/types/error";

/** WBS APIのHTTPエラーをstatusとBackendエラー本文付きで表す。 */
export class WbsApiError extends Error {
  readonly status: number;

  readonly errorResponse: ErrorResponse | null;

  constructor(status: number, errorResponse: ErrorResponse | null) {
    super(`WBS APIの実行に失敗しました。status=${status}`);
    this.name = "WbsApiError";
    this.status = status;
    this.errorResponse = errorResponse;
  }
}

/** JSON形式とは限らないSecurityエラーResponseを安全に読み取る。 */
const readErrorResponse = async (
  response: Response
): Promise<ErrorResponse | null> => {
  try {
    return (await response.json()) as ErrorResponse;
  } catch (_error: unknown) {
    return null;
  }
};

/** 非2xx ResponseをWbsApiErrorへ変換する。 */
const ensureSuccess = async (response: Response): Promise<void> => {
  if (!response.ok) {
    throw new WbsApiError(response.status, await readErrorResponse(response));
  }
};

/**
 * Projectの非archive Taskを読取り専用WBSとして取得する。
 *
 * @param projectId 参照対象Project ID
 * @returns Boardと共通のTask IDを持つWBS。Task未登録時は空配列
 * @throws WbsApiError 未認証、TASK_READ不足、Project未参加またはBackendエラーの場合
 */
const getWbs = async (projectId: number): Promise<WbsResponse> => {
  const response = await HttpClient.getRequest(
    `${API_PATHS.PROJECTS}/${projectId}/wbs`
  );
  await ensureSuccess(response);
  const payload = (await response.json()) as WbsResponse;
  return {
    ...payload,
    // 古いfixtureやTask未登録Responseでも、画面側へundefinedを伝播させない。
    tasks: payload.tasks ?? [],
  };
};

export default { getWbs };
