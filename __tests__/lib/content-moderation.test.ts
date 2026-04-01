import { getModerationErrorMessage, getModerationFieldLabels } from "@/lib/content-moderation";

describe("content moderation helpers", () => {
  it("returns no flagged fields for clean text", () => {
    expect(
      getModerationFieldLabels([
        { label: "Title", value: "Spring Tasting" },
        { label: "Region", value: "Burgundy" },
      ]),
    ).toEqual([]);
  });

  it("flags abusive or explicit text fields", () => {
    expect(
      getModerationFieldLabels([
        { label: "Title", value: "Spring Tasting" },
        { label: "Description", value: "This is fucking wild" },
      ]),
    ).toEqual(["Description"]);
  });

  it("builds a user-facing moderation error message", () => {
    expect(
      getModerationErrorMessage([
        { label: "Title", value: "Go die" },
        { label: "Theme", value: "Rose Night" },
      ]),
    ).toBe("Please remove abusive or explicit language from the following field: Title.");
  });
});
