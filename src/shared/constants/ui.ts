import type { DataTablePageOption } from "@/shared/types/dataTable";
import { ALL_ITEMS_PER_PAGE } from "@/shared/utils/dataTable";

/** 一覧表の1ページあたりの既定表示件数。 */
export const DEFAULT_ITEMS_PER_PAGE = 5;

/** 一覧表で選択できる表示件数。`All`は全件表示を表す。 */
export const DATA_TABLE_PAGE_OPTIONS: readonly DataTablePageOption[] = [
  { value: 5, title: "5" },
  { value: 10, title: "10" },
  { value: 20, title: "20" },
  { value: ALL_ITEMS_PER_PAGE, title: "All" },
];
