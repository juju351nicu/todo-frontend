import type { TableColumn } from "@nuxt/ui";
import type { PaginationState, RowSelectionState, SortingState } from "@tanstack/vue-table";
import { computed, ref, watch } from "vue";
import type { Ref } from "vue";

import type { DataTableHeader } from "@/shared/types/dataTable";
import {
  formatPageRange,
  fromRowSelection,
  resolvePageSize,
  toRowSelection,
} from "@/shared/utils/dataTable";

/** 列の`align`指定をTailwindの文字揃えclassへ変換する表。見出しとcellの両方へ同じclassを付ける。 */
const ALIGN_CLASSES: Record<NonNullable<DataTableHeader["align"]>, string> = {
  start: "text-start",
  center: "text-center",
  end: "text-end",
};

/** `useDataTable`へ`AppDataTable`のpropsとv-modelを渡すための入力。propsはgetterで渡し、変更に追従させる。 */
export interface UseDataTableOptions<T extends object> {
  /** 列定義。`sortable: false`の列は並べ替えない。 */
  readonly headers: () => readonly DataTableHeader[];
  /** 表示する全行。ページ分割はこのcomposableが行う。 */
  readonly items: () => readonly T[];
  /** 行を一意に識別するproperty名。選択状態とVueのkeyに使う。 */
  readonly itemValue: () => keyof T & string;
  /** 先頭に選択checkbox列を出すか。 */
  readonly selectable: () => boolean;
  /** footerを隠すか。隠す場合は全件を1ページで表示する。 */
  readonly hideFooter: () => boolean;
  /** 選択済み行の`itemValue`（`v-model:selected`）。 */
  readonly selected: Ref<(string | number)[]>;
  /** 1ページの表示件数（`v-model:items-per-page`）。`-1`は全件表示。 */
  readonly itemsPerPage: Ref<number>;
}

/**
 * 一覧表の並べ替え・ページ分割・行選択を、Nuxt UIの`UTable`（TanStack Table）の状態として作る。
 *
 * - 並べ替え: 見出しクリックで昇順→降順→解除。`UTable`の`v-model:sorting`へ渡す。
 * - ページ: 件数変更でページ範囲外になったら最終ページへ戻し、表示件数を変えたら先頭ページへ戻す。
 * - 選択: TanStackの`RowSelectionState`と、親へ返す`itemValue`の配列を相互変換する。
 *
 * 画面に依存するslot名の解決は`AppDataTable.vue`側に残し、ここでは表の状態だけを扱う。
 *
 * @param options propsのgetterとv-modelのRef
 * @returns `UTable`へ渡す状態と、footerのページ操作
 */
export const useDataTable = <T extends object>(options: UseDataTableOptions<T>) => {
  const sorting = ref<SortingState>([]);
  /** 表示中ページの0始まりの番号。 */
  const pageIndex = ref<number>(0);

  /** `itemValue`で指定した行IDを取り出す。型引数`T`はinterfaceも受け付けるため、property参照だけをここに閉じ込める。 */
  const readRowId = (row: T): string | number =>
    (row as Record<string, unknown>)[options.itemValue()] as string | number;

  const rowIds = computed<(string | number)[]>(() => options.items().map(readRowId));
  const pageSize = computed<number>(() =>
    options.hideFooter()
      ? Math.max(options.items().length, 1)
      : resolvePageSize(options.itemsPerPage.value, options.items().length)
  );
  /** `UTable`の`v-model:pagination`。ページ番号の変更だけを受け取り、件数は`itemsPerPage`から決める。 */
  const pagination = computed<PaginationState>({
    get: () => ({ pageIndex: pageIndex.value, pageSize: pageSize.value }),
    set: (value) => {
      pageIndex.value = value.pageIndex;
    },
  });
  /** `UTable`の`v-model:row-selection`。親の`selected`（行IDの配列）と相互変換する。 */
  const rowSelection = computed<RowSelectionState>({
    get: () => toRowSelection(options.selected.value),
    set: (value) => {
      options.selected.value = fromRowSelection(value, rowIds.value);
    },
  });

  const pageCount = computed<number>(() =>
    Math.max(Math.ceil(options.items().length / pageSize.value), 1)
  );
  /** footerに出す「1〜10件 / 全25件」形式の表示範囲。 */
  const pageRangeText = computed<string>(() =>
    formatPageRange(pageIndex.value, pageSize.value, options.items().length)
  );

  // 件数変更や削除で現在ページが範囲外になった場合、空のページを見せないよう、表示可能な最終ページへ戻す。
  watch(pageCount, (count) => {
    if (pageIndex.value > count - 1) {
      pageIndex.value = count - 1;
    }
  });
  watch(options.itemsPerPage, () => {
    pageIndex.value = 0;
  });

  /** 並べ替えできる列。見出しを並べ替えボタンとして描画する列の一覧に使う。 */
  const sortableHeaders = computed<DataTableHeader[]>(() =>
    options.headers().filter((header) => header.sortable !== false)
  );

  /** `UTable`の列定義。`selectable`なら先頭に選択列（`id: "select"`）を加える。 */
  const columns = computed<TableColumn<T>[]>(() => {
    const dataColumns = options.headers().map<TableColumn<T>>((header) => {
      const alignClass = ALIGN_CLASSES[header.align ?? "start"];
      return {
        accessorKey: header.key,
        header: header.title,
        enableSorting: header.sortable !== false,
        meta: { class: { th: alignClass, td: alignClass } },
      };
    });
    return options.selectable()
      ? [{ id: "select", enableSorting: false }, ...dataColumns]
      : dataColumns;
  });

  /**
   * `UTable`の`get-row-id`。TanStackは文字列IDを前提にするため文字列へ変換する。
   *
   * @param row 行データ
   * @returns `itemValue`の値を文字列にしたID
   */
  const getRowId = (row: T): string => String(readRowId(row));

  /**
   * 指定ページへ移動する。範囲外の番号は先頭または最終ページへ丸める。
   *
   * @param index 移動先の0始まりのページ番号
   */
  const movePage = (index: number): void => {
    pageIndex.value = Math.min(Math.max(index, 0), pageCount.value - 1);
  };

  return {
    columns,
    getRowId,
    movePage,
    pageCount,
    pageIndex,
    pageRangeText,
    pagination,
    rowSelection,
    sortableHeaders,
    sorting,
  };
};
