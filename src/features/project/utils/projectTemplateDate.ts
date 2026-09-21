/**
 * Dateをブラウザーのローカル日付としてdate input用のyyyy-MM-ddへ変換する。
 *
 * @param date 変換対象。省略時は現在日時。
 * @returns ローカルタイムゾーン基準のyyyy-MM-dd。
 */
export const toLocalDateInputValue = (date: Date = new Date()): string => {
  const timezoneOffset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - timezoneOffset).toISOString().slice(0, 10);
};

/**
 * 文字列がMySQL DATEとして扱える実在するyyyy-MM-ddか検査する。
 *
 * @param value date inputから受け取った文字列。
 * @returns 1000-01-01から9999-12-31までの実在日付ならtrue。
 */
export const isValidLocalDateInput = (value: string): boolean => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 1000) return false;

  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  date.setUTCHours(0, 0, 0, 0);
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
};
