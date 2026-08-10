/** data-tableの1ページあたりの既定表示件数。 */
export const DEFAULT_ITEMS_PER_PAGE = 5;

/** data-tableで選択できる表示件数。 */
export const DATA_TABLE_PAGE_OPTIONS = [
  { value: 5, title: "5" },
  { value: 10, title: "10" },
  { value: 20, title: "20" },
  { value: -1, title: "$vuetify.dataFooter.itemsPerPageAll" },
] as const;
