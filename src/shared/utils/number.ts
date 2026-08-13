/**
 * 文字列または数値の配列を数値配列へ変換する。
 *
 * @param values HTML input等から取得した数値表現
 * @returns 入力順を維持してNumber変換した配列。不正値はNaNとして保持する
 */
export const toNumberList = (
  values: ReadonlyArray<string | number>
): number[] => values.map((value) => Number(value));
