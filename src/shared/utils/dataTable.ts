import type { RowSelectionState } from "@tanstack/vue-table";

/** 全件表示を表す表示件数（表示件数の選択肢「All」の値）。 */
export const ALL_ITEMS_PER_PAGE = -1;

/**
 * 表示件数の選択値から、TanStack Tableへ渡す1ページの件数を求める。
 *
 * @param itemsPerPage 選択された表示件数。`-1`は全件表示
 * @param totalCount 表示対象の全件数
 * @returns 1以上のページ件数。全件表示で0件の場合も1を返し、TanStack Tableの0除算を避ける
 */
export const resolvePageSize = (itemsPerPage: number, totalCount: number): number =>
  itemsPerPage === ALL_ITEMS_PER_PAGE ? Math.max(totalCount, 1) : Math.max(itemsPerPage, 1);

/**
 * 一覧表の下に出す「表示中の範囲 / 全件数」の表記を作る。
 *
 * @param pageIndex 0始まりのページ番号
 * @param pageSize 1ページの件数
 * @param totalCount 全件数
 * @returns 例: `1〜5件 / 全12件`。0件の場合は`0件`
 */
export const formatPageRange = (
  pageIndex: number,
  pageSize: number,
  totalCount: number
): string => {
  if (totalCount === 0) {
    return "0件";
  }
  const start = pageIndex * pageSize + 1;
  const end = Math.min((pageIndex + 1) * pageSize, totalCount);
  return `${start}〜${end}件 / 全${totalCount}件`;
};

/** 選択済み行IDの配列を、TanStack Tableの行選択stateへ変換する。 */
export const toRowSelection = (selectedIds: readonly (string | number)[]): RowSelectionState =>
  Object.fromEntries(selectedIds.map((id) => [String(id), true]));

/**
 * TanStack Tableの行選択stateを、元の行ID型を保った配列へ戻す。
 *
 * @param selection TanStack Tableの行選択state。keyは`getRowId`が返した文字列
 * @param rowIds 表示対象全行のID。数値IDを文字列化せずに返すため、元の値をここから引く
 */
export const fromRowSelection = <T extends string | number>(
  selection: RowSelectionState,
  rowIds: readonly T[]
): T[] => rowIds.filter((id) => selection[String(id)] === true);
