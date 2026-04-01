jest.mock("@/lib/supabase", () => ({
  supabase: {},
}));

import {
  filterBlockedEvents,
  filterBlockedWines,
  formatMemberLabel,
  getBlockedMemberIdSet,
  isMemberBlocked,
} from "@/lib/member-blocks";

describe("member blocking helpers", () => {
  it("formats the best available member label", () => {
    expect(
      formatMemberLabel({
        first_name: "Alex",
        last_name: "Torelli",
        name: null,
        email: "alex@example.com",
      }),
    ).toBe("Alex Torelli");

    expect(
      formatMemberLabel({
        first_name: null,
        last_name: null,
        name: "Phina Host",
        email: "host@example.com",
      }),
    ).toBe("Phina Host");
  });

  it("creates a blocked member id set and checks membership", () => {
    const blockedIds = getBlockedMemberIdSet([
      { blocked_member_id: "member-2" },
      { blocked_member_id: "member-3" },
    ]);

    expect(isMemberBlocked(blockedIds, "member-2")).toBe(true);
    expect(isMemberBlocked(blockedIds, "member-4")).toBe(false);
  });

  it("filters blocked hosts and contributors from event and wine lists", () => {
    const blockedIds = new Set(["member-2"]);

    expect(
      filterBlockedEvents(
        [
          { id: "event-1", created_by: "member-1" },
          { id: "event-2", created_by: "member-2" },
        ],
        blockedIds,
      ),
    ).toEqual([{ id: "event-1", created_by: "member-1" }]);

    expect(
      filterBlockedWines(
        [
          { id: "wine-1", brought_by: "member-2" },
          { id: "wine-2", brought_by: "member-3" },
        ],
        blockedIds,
      ),
    ).toEqual([{ id: "wine-2", brought_by: "member-3" }]);
  });
});
