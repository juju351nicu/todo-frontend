/** 値がnull、undefined、空文字列、空配列かを判定する。 */
const isEmpty = (target: unknown): boolean =>
  target === null ||
  target === undefined ||
  ((typeof target === "string" || Array.isArray(target)) &&
    target.length === 0);

/** 文字列中の空白文字をすべて除去する。 */
const trimSpace = (target: string): string => target.replace(/\s/g, "");

/** 全角英数字を半角へ変換する。 */
const toHalfWidth = (target: string): string =>
  target.replace(/[Ａ-Ｚａ-ｚ０-９]/g, (value) =>
    String.fromCharCode(value.charCodeAt(0) - 0xfee0)
  );

/** 配列の重複を除去する。 */
const uniqArrayBySet = <T>(array: readonly T[]): T[] => [...new Set(array)];

/** 文字列または数値の配列を数値配列へ変換する。 */
const getNumberList = (
  values: ReadonlyArray<string | number>
): number[] => values.map((value) => Number(value));

export default {
  isEmpty,
  trimSpace,
  toHalfWidth,
  uniqArrayBySet,
  getNumberList,
};
