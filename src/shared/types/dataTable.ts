/**
 * `AppDataTable`の列定義。移行前のVuetify v-data-tableの`headers`と同じ形にし、composableの列定義を変えずに使えるようにする。
 */
export interface DataTableHeader {
  /** 行データのproperty名。表示値の取得とcell slot名（`<key>-cell`）に使用する。 */
  key: string;
  /** 見出しの表示名。 */
  title: string;
  /** 見出しとcellの水平位置。未指定は`start`。 */
  align?: "start" | "center" | "end";
  /** falseの場合だけ見出しクリックによる並べ替えを無効にする。未指定は並べ替え可能（Vuetifyの既定と同じ）。 */
  sortable?: boolean;
}

/** 1ページの表示件数の選択肢。`value`が`-1`の場合は全件表示を表す。 */
export interface DataTablePageOption {
  value: number;
  title: string;
}
