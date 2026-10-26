import { getBusinessToday } from "@/shared/utils/businessDate";

const ISO_LOCAL_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** yyyy-MM-ddとして存在する日付かをtimezoneに依存せず検査する。 */
export const isValidIsoLocalDate = (value: string): boolean => {
  if (!ISO_LOCAL_DATE_PATTERN.test(value)) {
    return false;
  }
  const [year, month, day] = value.split("-").map(Number);
  const parsedDate = new Date(Date.UTC(year, month - 1, day));
  return (
    parsedDate.getUTCFullYear() === year &&
    parsedDate.getUTCMonth() === month - 1 &&
    parsedDate.getUTCDate() === day
  );
};

/**
 * 日別予定・実績Formの初期日付とEVM・Excel帳票の初期基準日に使う「今日」を、業務日（Asia/Tokyo）で返す。
 * Backendは業務日で集計するため、利用端末のタイムゾーンで決めると日付の変わり目で1日ずれる。
 *
 * @returns yyyy-MM-dd形式の業務日
 */
export const getToday = (): string => getBusinessToday();

/** 分単位工数を0分、分だけ、時間と分のいずれかへ整形する。 */
export const formatEffortMinutes = (minutes: number): string => {
  const normalizedMinutes = Number.isSafeInteger(minutes) && minutes > 0
    ? minutes
    : 0;
  const hours = Math.floor(normalizedMinutes / 60);
  const remainingMinutes = normalizedMinutes % 60;
  if (hours === 0) {
    return `${remainingMinutes}分`;
  }
  return remainingMinutes === 0
    ? `${hours}時間`
    : `${hours}時間${remainingMinutes}分`;
};

/** 差分工数を正負記号付きで整形し、予定超過・未消化の向きを明確にする。 */
export const formatSignedEffortMinutes = (minutes: number): string => {
  if (!Number.isSafeInteger(minutes) || minutes === 0) {
    return "0分";
  }
  const sign = minutes > 0 ? "+" : "-";
  return `${sign}${formatEffortMinutes(Math.abs(minutes))}`;
};

/** 比較対象がない（null）工数は`—`、それ以外は`formatEffortMinutes`と同じ表記にする。 */
export const formatOptionalEffortMinutes = (minutes: number | null): string =>
  minutes === null ? "—" : formatEffortMinutes(minutes);
