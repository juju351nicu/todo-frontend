import type {
  AttendanceDayListResponse,
  AttendanceDayResponse,
  AttendanceMonthListResponse,
  AttendanceMonthResponse,
  AttendanceMonthStatus,
  AttendancePunchAction,
} from "@/features/attendance/types/attendance";
import HttpClient from "@/shared/api/httpClient";
import { API_PATHS } from "@/shared/constants/api";
import type { ErrorResponse } from "@/shared/types/error";

/** 本人勤怠APIのHTTPエラーをstatusとBackendエラー本文付きで表す。 */
export class AttendanceApiError extends Error {
  readonly status: number;

  readonly errorResponse: ErrorResponse | null;

  constructor(status: number, errorResponse: ErrorResponse | null) {
    super(`本人勤怠APIの実行に失敗しました。status=${status}`);
    this.name = "AttendanceApiError";
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

/** 非2xx ResponseをAttendanceApiErrorへ変換する。 */
const ensureSuccess = async (response: Response): Promise<void> => {
  if (!response.ok) {
    throw new AttendanceApiError(
      response.status,
      await readErrorResponse(response)
    );
  }
};

/**
 * API Responseで欠落した勤務・休憩配列とnullable値を画面用確定値へ正規化する。
 *
 * @param payload Backendから返された本人勤怠日
 * @returns 配列とnullable項目を確定した本人勤怠日
 */
const normalizeAttendanceDay = (
  payload: AttendanceDayResponse
): AttendanceDayResponse => ({
  ...payload,
  attendanceDayId: payload.attendanceDayId ?? null,
  note: payload.note ?? null,
  workPeriods: (payload.workPeriods ?? []).map((workPeriod) => ({
    ...workPeriod,
    endedAt: workPeriod.endedAt ?? null,
    breakPeriods: (workPeriod.breakPeriods ?? []).map((breakPeriod) => ({
      ...breakPeriod,
      endedAt: breakPeriod.endedAt ?? null,
    })),
  })),
});

/** 月次Responseのnullable項目と日別配列を画面用確定値へ正規化する。 */
const normalizeAttendanceMonth = (
  payload: AttendanceMonthResponse
): AttendanceMonthResponse => ({
  ...payload,
  attendanceMonthId: payload.attendanceMonthId ?? null,
  submittedBy: payload.submittedBy ?? null,
  submittedAt: payload.submittedAt ?? null,
  reviewedBy: payload.reviewedBy ?? null,
  reviewedAt: payload.reviewedAt ?? null,
  reviewComment: payload.reviewComment ?? null,
  closedBy: payload.closedBy ?? null,
  closedAt: payload.closedAt ?? null,
  days: (payload.days ?? []).map(normalizeAttendanceDay),
});

/**
 * 指定期間に登録済みの本人勤怠日を一括取得する。
 *
 * @param dateFrom 検索開始日。yyyy-MM-dd形式で境界を含む
 * @param dateTo 検索終了日。yyyy-MM-dd形式で境界を含む
 * @returns 指定期間と勤務日順の登録済み勤怠日
 * @throws AttendanceApiError 入力不正、認証・認可不足またはBackendエラーの場合
 */
const getDays = async (
  dateFrom: string,
  dateTo: string
): Promise<AttendanceDayListResponse> => {
  const query = new URLSearchParams({ dateFrom, dateTo });
  const response = await HttpClient.getRequest(
    `${API_PATHS.ATTENDANCE}/days?${query.toString()}`
  );
  await ensureSuccess(response);
  const payload = (await response.json()) as AttendanceDayListResponse;
  return {
    ...payload,
    days: (payload.days ?? []).map(normalizeAttendanceDay),
  };
};

/**
 * 指定勤務日の本人打刻状態と全勤務・休憩区間を取得する。
 *
 * @param workDate 表示対象勤務日。yyyy-MM-dd形式
 * @returns 未打刻日を含む本人勤怠日詳細
 * @throws AttendanceApiError 認証・認可不足、データ不整合またはBackendエラーの場合
 */
const getDay = async (workDate: string): Promise<AttendanceDayResponse> => {
  const response = await HttpClient.getRequest(
    `${API_PATHS.ATTENDANCE}/days/${encodeURIComponent(workDate)}`
  );
  await ensureSuccess(response);
  return normalizeAttendanceDay(
    (await response.json()) as AttendanceDayResponse
  );
};

/**
 * Client時刻を送らず、指定操作をBackendのserver timestampで確定する。
 *
 * @param action 出勤・退勤・休憩開始・休憩終了のいずれか
 * @returns 打刻後の最新本人勤怠日詳細
 * @throws AttendanceApiError 認証・認可不足、状態競合またはBackendエラーの場合
 */
const punch = async (
  action: AttendancePunchAction
): Promise<AttendanceDayResponse> => {
  const response = await HttpClient.postRequest(
    `${API_PATHS.ATTENDANCE}/punches/${action}`,
    null
  );
  await ensureSuccess(response);
  return normalizeAttendanceDay(
    (await response.json()) as AttendanceDayResponse
  );
};

/** 指定月の本人月次状態、合計、登録済み日別明細を取得する。 */
const getMonth = async (yearMonth: string): Promise<AttendanceMonthResponse> => {
  const response = await HttpClient.getRequest(
    `${API_PATHS.ATTENDANCE}/months/${encodeURIComponent(yearMonth)}`
  );
  await ensureSuccess(response);
  return normalizeAttendanceMonth(
    (await response.json()) as AttendanceMonthResponse
  );
};

/** DRAFTまたはREJECTEDの本人月次勤怠を最新versionで提出する。 */
const submitMonth = async (
  yearMonth: string,
  version: number
): Promise<AttendanceMonthResponse> => {
  const response = await HttpClient.postRequest(
    `${API_PATHS.ATTENDANCE}/months/${encodeURIComponent(yearMonth)}/submit`,
    { version }
  );
  await ensureSuccess(response);
  return normalizeAttendanceMonth(
    (await response.json()) as AttendanceMonthResponse
  );
};

/** 管理対象月の永続化済み勤怠月を任意の状態で絞り込む。 */
const getAdministrationMonths = async (
  yearMonth: string,
  status: AttendanceMonthStatus | null
): Promise<AttendanceMonthListResponse> => {
  const query = new URLSearchParams({ yearMonth });
  if (status !== null) {
    query.set("status", status);
  }
  const response = await HttpClient.getRequest(
    `${API_PATHS.ATTENDANCE}/administration/months?${query.toString()}`
  );
  await ensureSuccess(response);
  const payload = (await response.json()) as AttendanceMonthListResponse;
  return { ...payload, months: payload.months ?? [] };
};

/** 管理対象accountの月次状態、合計、登録済み日別明細を取得する。 */
const getAdministrationMonth = async (
  accountId: number,
  yearMonth: string
): Promise<AttendanceMonthResponse> => {
  const response = await HttpClient.getRequest(
    `${API_PATHS.ATTENDANCE}/administration/accounts/${accountId}/months/${encodeURIComponent(yearMonth)}`
  );
  await ensureSuccess(response);
  return normalizeAttendanceMonth(
    (await response.json()) as AttendanceMonthResponse
  );
};

/** SUBMITTED月を任意コメント付きで承認する。 */
const approveMonth = async (
  attendanceMonthId: number,
  version: number,
  reviewComment: string | null
): Promise<AttendanceMonthResponse> => {
  const response = await HttpClient.postRequest(
    `${API_PATHS.ATTENDANCE}/administration/months/${attendanceMonthId}/approve`,
    { version, reviewComment }
  );
  await ensureSuccess(response);
  return normalizeAttendanceMonth(
    (await response.json()) as AttendanceMonthResponse
  );
};

/** SUBMITTED月を必須理由付きで本人へ差し戻す。 */
const rejectMonth = async (
  attendanceMonthId: number,
  version: number,
  reason: string
): Promise<AttendanceMonthResponse> => {
  const response = await HttpClient.postRequest(
    `${API_PATHS.ATTENDANCE}/administration/months/${attendanceMonthId}/reject`,
    { version, reason }
  );
  await ensureSuccess(response);
  return normalizeAttendanceMonth(
    (await response.json()) as AttendanceMonthResponse
  );
};

/** APPROVED月を最新versionで締める。 */
const closeMonth = async (
  attendanceMonthId: number,
  version: number
): Promise<AttendanceMonthResponse> => {
  const response = await HttpClient.postRequest(
    `${API_PATHS.ATTENDANCE}/administration/months/${attendanceMonthId}/close`,
    { version }
  );
  await ensureSuccess(response);
  return normalizeAttendanceMonth(
    (await response.json()) as AttendanceMonthResponse
  );
};

export default {
  approveMonth,
  closeMonth,
  getAdministrationMonth,
  getAdministrationMonths,
  getDay,
  getDays,
  getMonth,
  punch,
  rejectMonth,
  submitMonth,
};
