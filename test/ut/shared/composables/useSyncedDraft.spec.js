import { describe, expect, it } from "vitest";
import { nextTick, reactive } from "vue";

import { useSyncedDraft } from "@/shared/composables/useSyncedDraft";

describe("useSyncedDraft", () => {
  it("親の値で初期化し、親の値が変わると下書きを置き換える", async () => {
    const props = reactive({ statusDate: "2026-10-01" });
    const draft = useSyncedDraft(() => props.statusDate);

    draft.value = "2026-10-15";
    props.statusDate = "2026-10-20";
    await nextTick();

    expect(draft.value).toBe("2026-10-20");
  });

  it("オブジェクトは複製し、下書きの編集が親の値を書き換えない", async () => {
    const props = reactive({ range: { from: "2026-10-01", to: "2026-10-31" } });
    const draft = useSyncedDraft(
      () => props.range,
      (range) => ({ ...range })
    );

    draft.value.from = "2026-10-10";
    expect(props.range.from).toBe("2026-10-01");

    props.range.to = "2026-11-30";
    await nextTick();
    expect(draft.value).toEqual({ from: "2026-10-01", to: "2026-11-30" });
  });
});
