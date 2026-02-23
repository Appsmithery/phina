import { colors, useTheme } from "@/lib/theme";

describe("theme", () => {
  it("exports brand colors", () => {
    expect(colors.primary).toBe("#B58271");
    expect(colors.background).toBe("#F2EFE9");
    expect(colors.text).toBe("#4A3B35");
  });

  it("useTheme returns colors", () => {
    expect(useTheme()).toEqual(colors);
  });
});
