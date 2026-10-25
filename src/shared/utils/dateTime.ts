const SHORT_DATE_TIME_FORMATTER = new Intl.DateTimeFormat("ja-JP", {
  dateStyle: "short",
  timeStyle: "short",
});

/**
 * BackendのISO日時を、利用端末のタイムゾーンで短い日付・時刻（例: `2026/10/26 9:05`）へ変換する。
 *
 * @param value ISO 8601形式の日時
 * @returns 解釈できない値の場合は元の文字列
 */
export const formatShortDateTime = (value: string): string => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : SHORT_DATE_TIME_FORMATTER.format(date);
};
