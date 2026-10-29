/**
 * Backendが業務日の判定と集計に使うタイムゾーン。
 * Backendの各Serviceは`ZoneId.of("Asia/Tokyo")`で業務日を決めるため、画面の既定日付も同じ基準で作る。
 */
export const BUSINESS_TIME_ZONE = "Asia/Tokyo";

/**
 * 業務タイムゾーンのUTCからのoffset（`datetime-local`の入力値へ付けてBackendへ送る形）。
 * 日本時間には夏時間がないため、年間を通して同じ値になる。
 */
export const BUSINESS_TIME_ZONE_OFFSET = "+09:00";

/** 業務タイムゾーンのUTCからのoffset（ミリ秒）。`BUSINESS_TIME_ZONE_OFFSET`と同じ9時間。 */
export const BUSINESS_TIME_ZONE_OFFSET_MILLISECONDS = 9 * 60 * 60 * 1000;

/** 業務タイムゾーンの年・月・日を数値で取り出すformatter。`en-US`は数字だけを返すため、表示ロケールに依存しない。 */
const BUSINESS_DATE_PARTS_FORMATTER = new Intl.DateTimeFormat("en-US", {
  timeZone: BUSINESS_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** 業務日の年・月・日。`month`は1〜12。 */
interface BusinessDateParts {
  year: number;
  month: number;
  day: number;
}

/**
 * 指定時刻を業務タイムゾーンの年・月・日へ分解する。
 *
 * @param now 変換対象の時刻
 * @returns 業務タイムゾーンでの年・月（1〜12）・日
 */
const toBusinessDateParts = (now: Date): BusinessDateParts => {
  const parts = BUSINESS_DATE_PARTS_FORMATTER.formatToParts(now);
  const valueOf = (type: Intl.DateTimeFormatPartTypes): number =>
    Number(parts.find((part) => part.type === type)?.value);
  return { year: valueOf("year"), month: valueOf("month"), day: valueOf("day") };
};

/** 年・月（1〜12）・日をdate input用のyyyy-MM-ddへ整形する。 */
const formatIsoDate = (year: number, month: number, day: number): string =>
  `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

/**
 * 指定時刻の業務日（Asia/Tokyo）をyyyy-MM-ddで返す。
 * 利用端末のタイムゾーンに依存せず、Backendが「今日」とみなす日付と一致させる。
 *
 * @param now 基準時刻。省略時は現在時刻
 * @returns yyyy-MM-dd形式の業務日
 */
export const getBusinessToday = (now: Date = new Date()): string => {
  const { year, month, day } = toBusinessDateParts(now);
  return formatIsoDate(year, month, day);
};

/**
 * 指定時刻を含む業務月（Asia/Tokyo）の初日と末日を返す。
 *
 * @param now 基準時刻。省略時は現在時刻
 * @returns yyyy-MM-dd形式の月初日と月末日
 */
export const getBusinessMonthRange = (
  now: Date = new Date()
): { dateFrom: string; dateTo: string } => {
  const { year, month } = toBusinessDateParts(now);
  // Date.UTCの日に0を渡すと前月の末日になるため、翌月の0日で当月の日数を求める。
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return {
    dateFrom: formatIsoDate(year, month, 1),
    dateTo: formatIsoDate(year, month, lastDay),
  };
};
