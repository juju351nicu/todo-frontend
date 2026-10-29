<script setup lang="ts" generic="T extends object">
import { getPaginationRowModel } from "@tanstack/vue-table";
import { computed, useSlots } from "vue";

import { useDataTable } from "@/shared/composables/useDataTable";
import type { DataTableHeader, DataTablePageOption } from "@/shared/types/dataTable";

/**
 * 行を詰めた表示で、並べ替え・ページ分割・行選択ができる一覧表。Nuxt UIの`UTable`で作る。
 *
 * - 見出しクリックで昇順→降順→解除の順に並べ替える（`sortable: false`の列を除く）。
 * - `selectable`がtrueの場合、先頭列に選択checkboxを表示し、選択行の`itemValue`を`selected`へ反映する。
 *   見出しのcheckboxは表示中ページの行だけを対象にする（見えていない行まで選ばないため）。
 * - footerに表示件数の選択とページ移動を表示する。`hideFooter`がtrueの場合は全件を1ページで表示する。
 * - cellの表示を変える場合は`<key>-cell`slotを使う。slot propsの`item`は行データ、`value`はその列の値。
 *
 * 並べ替え・ページ・選択の状態は`useDataTable`が持ち、このcomponentは描画とslotの受け渡しだけを行う。
 */
const props = withDefaults(
  defineProps<{
    headers: readonly DataTableHeader[];
    items: T[];
    /** 行を一意に識別するproperty名。選択状態とVueのkeyに使用する。 */
    itemValue: keyof T & string;
    selectable?: boolean;
    itemsPerPageOptions?: readonly DataTablePageOption[];
    hideFooter?: boolean;
    loading?: boolean;
    /** 表示行が0件の場合の文言。 */
    noDataText?: string;
  }>(),
  {
    selectable: false,
    itemsPerPageOptions: () => [],
    hideFooter: false,
    loading: false,
    noDataText: "表示するデータはありません。",
  }
);

/** 選択済み行の`itemValue`。`selectable`がfalseの場合は変更しない。 */
const selected = defineModel<(string | number)[]>("selected", { default: () => [] });
/** 1ページの表示件数。`-1`は全件表示。 */
const itemsPerPage = defineModel<number>("itemsPerPage", { default: 10 });

const slots = useSlots();
/** 親が渡した`<key>-cell`slotの名前。`UTable`の同名slotへそのまま中継する。 */
const cellSlotNames = computed<string[]>(() =>
  Object.keys(slots).filter((name) => name.endsWith("-cell"))
);

const {
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
} = useDataTable<T>({
  headers: () => props.headers,
  items: () => props.items,
  itemValue: () => props.itemValue,
  selectable: () => props.selectable,
  hideFooter: () => props.hideFooter,
  selected,
  itemsPerPage,
});
</script>

<template>
  <div class="bg-default text-default">
    <UTable
      v-model:sorting="sorting"
      v-model:pagination="pagination"
      v-model:row-selection="rowSelection"
      :data="items"
      :columns="columns"
      :get-row-id="getRowId"
      :pagination-options="{ getPaginationRowModel: getPaginationRowModel() }"
      :loading="loading"
      :empty="noDataText"
    >
      <template #select-header="{ table }">
        <UCheckbox
          :model-value="
            table.getIsSomePageRowsSelected() ? 'indeterminate' : table.getIsAllPageRowsSelected()
          "
          aria-label="表示中の行をすべて選択"
          @update:model-value="
            (value: boolean | 'indeterminate') => table.toggleAllPageRowsSelected(value === true)
          "
        />
      </template>
      <template #select-cell="{ row }">
        <UCheckbox
          :model-value="row.getIsSelected()"
          aria-label="行を選択"
          @update:model-value="
            (value: boolean | 'indeterminate') => row.toggleSelected(value === true)
          "
        />
      </template>
      <!-- 未ソートの列の矢印は、hover中だけ薄く表示する。 -->
      <template
        v-for="header in sortableHeaders"
        #[`${header.key}-header`]="{ column }"
        :key="header.key"
      >
        <button
          type="button"
          class="group inline-flex items-center gap-1 font-medium"
          @click="column.getToggleSortingHandler()?.($event)"
        >
          {{ header.title }}
          <UIcon
            :name="column.getIsSorted() === 'desc' ? 'i-mdi-arrow-down' : 'i-mdi-arrow-up'"
            class="size-4"
            :class="column.getIsSorted() ? 'opacity-100' : 'opacity-0 group-hover:opacity-50'"
          />
        </button>
      </template>
      <template v-for="slotName in cellSlotNames" #[slotName]="cellContext" :key="slotName">
        <slot :name="slotName" :item="cellContext.row.original" :value="cellContext.getValue()" />
      </template>
    </UTable>
    <div
      v-if="!hideFooter"
      class="flex flex-wrap items-center justify-end gap-x-6 border-t border-default px-1 py-1 text-sm"
    >
      <div v-if="itemsPerPageOptions.length" class="flex items-center gap-4">
        <span>表示行数</span>
        <USelect
          v-model="itemsPerPage"
          :items="[...itemsPerPageOptions]"
          value-key="value"
          label-key="title"
          variant="outline"
          size="sm"
          class="w-18"
          :ui="{ base: 'ps-4 pe-9', trailing: 'pe-2' }"
          aria-label="表示行数"
        />
      </div>
      <span>{{ pageRangeText }}</span>
      <div class="flex items-center">
        <UButton
          icon="i-mdi-page-first"
          variant="ghost"
          square
          :disabled="pageIndex === 0"
          aria-label="最初のページ"
          @click="movePage(0)"
        />
        <UButton
          icon="i-mdi-chevron-left"
          variant="ghost"
          square
          :disabled="pageIndex === 0"
          aria-label="前のページ"
          @click="movePage(pageIndex - 1)"
        />
        <UButton
          icon="i-mdi-chevron-right"
          variant="ghost"
          square
          :disabled="pageIndex >= pageCount - 1"
          aria-label="次のページ"
          @click="movePage(pageIndex + 1)"
        />
        <UButton
          icon="i-mdi-page-last"
          variant="ghost"
          square
          :disabled="pageIndex >= pageCount - 1"
          aria-label="最後のページ"
          @click="movePage(pageCount - 1)"
        />
      </div>
    </div>
  </div>
</template>
