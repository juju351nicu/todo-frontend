// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";

import AppDataTable from "@/shared/components/AppDataTable.vue";
import { mountWithUi } from "../../support/mountWithUi";

const headers = [
  { key: "id", title: "ID" },
  { key: "name", title: "名前" },
];
const items = Array.from({ length: 12 }, (_, index) => ({ id: index + 1, name: `行${index + 1}` }));

describe("AppDataTable", () => {
  let wrapper;

  afterEach(() => {
    wrapper?.unmount();
  });

  const mountTable = () => {
    wrapper = mountWithUi(AppDataTable, {
      props: {
        headers,
        items,
        itemValue: "id",
        selectable: true,
        selected: [],
        itemsPerPage: 5,
        "onUpdate:selected": (value) => wrapper.setProps({ selected: value }),
      },
    });
  };

  it("1ページに表示件数ぶんの行を出し、「開始-終了 of 全件」を出す", () => {
    mountTable();

    expect(wrapper.findAll('[aria-label="行を選択"]')).toHaveLength(5);
    expect(wrapper.text()).toContain("1-5 of 12");
  });

  it("見出しのcheckboxは、表示中のページの行だけを選ぶ", async () => {
    mountTable();

    await wrapper.find('[aria-label="表示中の行をすべて選択"]').trigger("click");

    expect(wrapper.emitted("update:selected").at(-1)).toEqual([[1, 2, 3, 4, 5]]);
  });

  it("行のcheckboxで、その行のitemValueを選ぶ", async () => {
    mountTable();

    await wrapper.findAll('[aria-label="行を選択"]')[1].trigger("click");

    expect(wrapper.emitted("update:selected").at(-1)).toEqual([[2]]);
  });
});
