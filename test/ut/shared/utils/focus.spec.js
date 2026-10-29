import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createDataAttributeSelector,
  focusFirstEnabledElement,
} from "@/shared/utils/focus";

/**
 * 単体テストの実行環境にはDOMがないため、selectorごとの要素を返すdocumentへ差し替える。
 *
 * @param elements selectorをkey、`{ disabled }`をvalueとする要素の定義。keyにないselectorはnull
 * @returns フォーカスを移したselectorの記録
 */
const stubDocument = (elements) => {
  const focused = [];
  vi.stubGlobal("document", {
    querySelector: (selector) =>
      selector in elements
        ? {
            focus: () => focused.push(selector),
            matches: (query) => query === ":disabled" && elements[selector].disabled,
          }
        : null,
  });
  return focused;
};

describe("focusFirstEnabledElement", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("候補の先頭から、見つかった最初の要素へフォーカスを移す", async () => {
    const focused = stubDocument({ "#a": { disabled: false }, "#b": { disabled: false } });

    await focusFirstEnabledElement(["#a", "#b"]);

    expect(focused).toEqual(["#a"]);
  });

  it("disabledの要素と見つからない候補は飛ばす", async () => {
    const focused = stubDocument({ "#a": { disabled: true }, "#c": { disabled: false } });

    await focusFirstEnabledElement(["#a", "#b", "#c"]);

    expect(focused).toEqual(["#c"]);
  });

  it("どの候補も操作できなければフォーカスを動かさない", async () => {
    const focused = stubDocument({ "#a": { disabled: true } });

    await focusFirstEnabledElement(["#a", "#b"]);

    expect(focused).toEqual([]);
  });

  it("DOMのない実行環境では何もしない", async () => {
    await expect(focusFirstEnabledElement(["#a"])).resolves.toBeUndefined();
  });
});

describe("createDataAttributeSelector", () => {
  it("属性名と値から、その部品を探すselectorを作る", () => {
    const buildSelector = createDataAttributeSelector("data-dashboard-control");

    expect(buildSelector("reload")).toBe('[data-dashboard-control="reload"]');
    expect(buildSelector("activate:7")).toBe('[data-dashboard-control="activate:7"]');
  });
});
