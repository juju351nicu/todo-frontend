import type {
  AnnouncementCreateRequest,
  NotificationCenterResponse,
  NotificationEvent,
  NotificationReadResponse,
} from "@/features/notification/types/notification";
import HttpClient from "@/shared/api/httpClient";
import { API_PATHS } from "@/shared/constants/api";
import type { ErrorResponse } from "@/shared/types/error";

/** 通知APIのHTTPエラーをstatusとBackend項目エラー付きで表す。 */
export class NotificationApiError extends Error {
  readonly status: number;

  readonly errorResponse: ErrorResponse | null;

  constructor(status: number, errorResponse: ErrorResponse | null) {
    super(`通知APIの実行に失敗しました。status=${status}`);
    this.name = "NotificationApiError";
    this.status = status;
    this.errorResponse = errorResponse;
  }
}

/** JSONとは限らないSecurityエラーを共通ErrorResponseとして安全に読み取る。 */
const readErrorResponse = async (
  response: Response
): Promise<ErrorResponse | null> => {
  try {
    return (await response.json()) as ErrorResponse;
  } catch (_error: unknown) {
    return null;
  }
};

/** 非2xx Responseを画面で認証・認可・入力不正へ分岐できる例外に変換する。 */
const ensureSuccess = async (response: Response): Promise<void> => {
  if (!response.ok) {
    throw new NotificationApiError(
      response.status,
      await readErrorResponse(response)
    );
  }
};

/** 認証利用者のイベント型通知と導出型警告を取得する。 */
const getNotificationCenter = async (): Promise<NotificationCenterResponse> => {
  const response = await HttpClient.getRequest(API_PATHS.NOTIFICATIONS);
  await ensureSuccess(response);
  return (await response.json()) as NotificationCenterResponse;
};

/** 現在時刻までのイベント型通知を一括既読にする。 */
const markEventsRead = async (): Promise<NotificationReadResponse> => {
  const response = await HttpClient.postRequest(
    `${API_PATHS.NOTIFICATIONS}/events/read`,
    null
  );
  await ensureSuccess(response);
  return (await response.json()) as NotificationReadResponse;
};

/**
 * permissionを持つ管理者として全アカウント向けお知らせを発行する。
 *
 * @param payload 前後空白を除いた件名・本文と任意のUTC表示終了時刻
 */
const createAnnouncement = async (
  payload: AnnouncementCreateRequest
): Promise<NotificationEvent> => {
  const response = await HttpClient.postRequest(
    API_PATHS.ADMINISTRATION_NOTIFICATION_ANNOUNCEMENTS,
    payload
  );
  await ensureSuccess(response);
  return (await response.json()) as NotificationEvent;
};

export default {
  createAnnouncement,
  getNotificationCenter,
  markEventsRead,
};
