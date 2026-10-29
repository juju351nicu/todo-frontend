import { describe, expect, it } from "vitest";

import { isValidLocalDateInput } from "@/features/project/utils/projectTemplateDate";

describe("projectTemplateDate", () => {
  it("閏日を実在する日付として受理する", () => {
    expect(isValidLocalDateInput("2028-02-29")).toBe(true);
  });

  it("存在しない日付を拒否する", () => {
    expect(isValidLocalDateInput("2026-02-30")).toBe(false);
  });

  it.each(["2026-9-21", "0999-12-31", "", "not-a-date"])(
    "MySQL DATE契約外の値 %s を拒否する",
    (value) => {
      expect(isValidLocalDateInput(value)).toBe(false);
    }
  );
});
