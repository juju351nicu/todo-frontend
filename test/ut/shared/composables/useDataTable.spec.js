import { describe, expect, it } from "vitest";
import { nextTick, ref } from "vue";

import { useDataTable } from "@/shared/composables/useDataTable";

/** 3列（idは並べ替え不可・中央揃え）の見出し。 */
const headers = [
  { key: "id", title: "ID", sortable: false, align: "center" },
  { key: "name", title: "名前" },
  { key: "amount", title: "金額", align: "end" },
];

/** id 1〜count の行を作る。 */
const buildItems = (count) =>
  Array.from({ length: count }, (_, index) => ({ id: index + 1, name: `行${index + 1}`, amount: index * 10 }));

/**
 * テスト用の`useDataTable`を作る。propsはrefで持ち、getter経由で渡す（componentと同じ渡し方）。
 *
 * @param overrides 既定値を上書きする設定
 */
const setup = (overrides = {}) => {
  const items = ref(overrides.items ?? buildItems(25));
  const selectable = ref(overrides.selectable ?? false);
  const hideFooter = ref(overrides.hideFooter ?? false);
  const selected = ref(overrides.selected ?? []);
  const itemsPerPage = ref(overrides.itemsPerPage ?? 10);
  const table = useDataTable({
    headers: () => headers,
    items: () => items.value,
    itemValue: () => "id",
    selectable: () => selectable.value,
    hideFooter: () => hideFooter.value,
    selected,
    itemsPerPage,
  });
  return { table, items, selectable, hideFooter, selected, itemsPerPage };
};

describe("useDataTable", () => {
  it("列定義へ見出し・並べ替え可否・文字揃えclassを写し、selectableなら先頭に選択列を加える", () => {
    const { table, selectable } = setup();

    expect(table.columns.value.map((column) => column.accessorKey)).toEqual(["id", "name", "amount"]);
    expect(table.columns.value[0]).toMatchObject({ enableSorting: false, meta: { class: { th: "text-center" } } });
    expect(table.columns.value[2].meta.class.td).toBe("text-end");
    expect(table.sortableHeaders.value.map((header) => header.key)).toEqual(["name", "amount"]);

    selectable.value = true;
    expect(table.columns.value[0]).toEqual({ id: "select", enableSorting: false });
  });

  it("表示件数でページ数と表示範囲を計算し、範囲外のページ番号は丸める", () => {
    const { table } = setup();

    expect(table.pageCount.value).toBe(3);
    expect(table.pageRangeText.value).toBe("1〜10件 / 全25件");
    table.movePage(2);
    expect(table.pageRangeText.value).toBe("21〜25件 / 全25件");
    table.movePage(99);
    expect(table.pageIndex.value).toBe(2);
    table.movePage(-1);
    expect(table.pageIndex.value).toBe(0);
  });

  it("行が減って現在ページが範囲外になったら最終ページへ戻す", async () => {
    const { table, items } = setup();
    table.movePage(2);

    items.value = buildItems(12);
    await nextTick();

    expect(table.pageIndex.value).toBe(1);
  });

  it("表示件数を変えたら先頭ページへ戻す", async () => {
    const { table, itemsPerPage } = setup();
    table.movePage(1);

    itemsPerPage.value = 5;
    await nextTick();

    expect(table.pageIndex.value).toBe(0);
    expect(table.pageCount.value).toBe(5);
  });

  it("hideFooterなら全件を1ページにする", () => {
    const { table } = setup({ hideFooter: true });

    expect(table.pagination.value.pageSize).toBe(25);
    expect(table.pageCount.value).toBe(1);
  });

  it("行選択stateと親のselected（行IDの配列）を相互変換する", () => {
    const { table, selected } = setup({ selectable: true, selected: [2] });

    expect(table.rowSelection.value).toEqual({ 2: true });
    table.rowSelection.value = { 1: true, 3: true };
    expect(selected.value).toEqual([1, 3]);
    expect(table.getRowId({ id: 7 })).toBe("7");
  });
});
