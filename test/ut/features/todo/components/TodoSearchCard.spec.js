// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";

import TodoSearchCard from "@/features/todo/components/TodoSearchCard.vue";
import { mountWithUi } from "../../../support/mountWithUi";

describe("TodoSearchCard", () => {
  let wrapper;

  afterEach(() => {
    wrapper?.unmount();
  });

  it("完了状態のcheckboxで、選択値の配列（\"0\"・\"1\"）を親へ返す", async () => {
    wrapper = mountWithUi(TodoSearchCard, {
      props: {
        searchTitle: "",
        selectedDoneFlag: ["0"],
        "onUpdate:selectedDoneFlag": (value) => wrapper.setProps({ selectedDoneFlag: value }),
      },
    });

    const checkboxes = wrapper.findAll('button[role="checkbox"]');
    expect(checkboxes).toHaveLength(2);
    await checkboxes[1].trigger("click");

    expect(wrapper.emitted("update:selectedDoneFlag").at(-1)).toEqual([["0", "1"]]);
  });

  it("「検索」で search を通知する", async () => {
    wrapper = mountWithUi(TodoSearchCard, { props: { searchTitle: "", selectedDoneFlag: [] } });

    await wrapper.findAll("button").find((button) => button.text() === "検索").trigger("click");

    expect(wrapper.emitted("search")).toHaveLength(1);
  });
});
