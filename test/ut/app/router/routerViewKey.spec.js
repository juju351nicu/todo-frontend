import { describe, expect, it } from "vitest";

import { resolveRouterViewKey } from "@/app/router/routerViewKey";

describe("resolveRouterViewKey", () => {
  it("Project IDが変わるとkeyも変わり、画面が作り直される", () => {
    expect(resolveRouterViewKey({ projectId: "1" })).toBe("1");
    expect(resolveRouterViewKey({ projectId: "2" })).toBe("2");
  });

  it("同じ名前のparamが重なった場合は先頭のProject IDを使う", () => {
    expect(resolveRouterViewKey({ projectId: ["3", "4"] })).toBe("3");
  });

  it("Project IDのないrouteにはkeyを付けない", () => {
    expect(resolveRouterViewKey({})).toBeUndefined();
    expect(resolveRouterViewKey({ id: "7" })).toBeUndefined();
  });
});
