import type { BasicDashboardResponse } from "@/features/dashboard/types/dashboard";
import HttpClient from "@/shared/api/httpClient";
import { API_PATHS } from "@/shared/constants/api";
import type { ErrorResponse } from "@/shared/types/error";

/** Basic Dashboard APIのHTTPエラーをstatusとBackendエラー本文付きで表す。 */
export class DashboardApiError extends Error {
  readonly status: number;

  readonly errorResponse: ErrorResponse | null;

  constructor(status: number, errorResponse: ErrorResponse | null) {
    super(`Dashboard APIの実行に失敗しました。status=${status}`);
    this.name = "DashboardApiError";
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

/** 非2xx ResponseをDashboardApiErrorへ変換する。 */
const ensureSuccess = async (response: Response): Promise<void> => {
  if (!response.ok) {
    throw new DashboardApiError(
      response.status,
      await readErrorResponse(response)
    );
  }
};

/**
 * 現在のSession利用者向けBasic Dashboardを取得する。
 * permission不足の業務セクションはBackend契約どおりavailable=falseで返す。
 *
 * @returns 同一生成時刻で集計されたMy Tasks、通知、Project、本人勤怠
 * @throws DashboardApiError 未認証またはBackendエラーの場合
 */
const getBasicDashboard = async (): Promise<BasicDashboardResponse> => {
  const response = await HttpClient.getRequest(API_PATHS.DASHBOARD_BASIC);
  await ensureSuccess(response);
  const payload = (await response.json()) as BasicDashboardResponse;
  return {
    ...payload,
    myTasks: {
      ...payload.myTasks,
      items: payload.myTasks.items ?? [],
    },
    notifications: {
      ...payload.notifications,
      recentEvents: payload.notifications.recentEvents ?? [],
    },
    projects: {
      ...payload.projects,
      cards: payload.projects.cards ?? [],
    },
  };
};

export default {
  getBasicDashboard,
};
