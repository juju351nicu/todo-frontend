/** 文字列または数値の配列を数値配列へ変換する。 */
export const toNumberList = (
  values: ReadonlyArray<string | number>
): number[] => values.map((value) => Number(value));
