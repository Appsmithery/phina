import { QueryClient } from "@tanstack/react-query";
import { applyOptimisticWineRemoval, restoreRemovedWineCache } from "@/hooks/use-remove-wine";

jest.mock("@/lib/supabase", () => ({
  supabase: {
    from: jest.fn(),
  },
}));

describe("use-remove-wine cache helpers", () => {
  it("removes the wine from cellar and event caches immediately, then restores on rollback", () => {
    const queryClient = new QueryClient();
    const wine = { id: "wine-1", event_id: "event-1" };
    const cellarList = [{ id: "wine-1" }, { id: "wine-2" }];
    const eventList = [{ id: "wine-1" }, { id: "wine-3" }];
    const ratingSummary = [{ wine_id: "wine-1", thumbs_up: 2 }, { wine_id: "wine-3", thumbs_up: 1 }];
    const tagSummary = [{ wine_id: "wine-1", tag: "fruit" }, { wine_id: "wine-3", tag: "oak" }];

    queryClient.setQueryData(["wine", "wine-1"], wine);
    queryClient.setQueryData(["cellar", "my-wines", "member-1"], cellarList);
    queryClient.setQueryData(["wines", "event-1"], eventList);
    queryClient.setQueryData(["event_rating_summary", "event-1"], ratingSummary);
    queryClient.setQueryData(["eventWineRatings", "event-1"], ratingSummary);
    queryClient.setQueryData(["eventWineTagSummary", "event-1"], tagSummary);

    const snapshot = applyOptimisticWineRemoval(queryClient, {
      wineId: "wine-1",
      memberId: "member-1",
      eventId: "event-1",
    });

    expect(queryClient.getQueryData(["wine", "wine-1"])).toBeNull();
    expect(queryClient.getQueryData(["cellar", "my-wines", "member-1"])).toEqual([{ id: "wine-2" }]);
    expect(queryClient.getQueryData(["wines", "event-1"])).toEqual([{ id: "wine-3" }]);
    expect(queryClient.getQueryData(["event_rating_summary", "event-1"])).toEqual([
      { wine_id: "wine-3", thumbs_up: 1 },
    ]);
    expect(queryClient.getQueryData(["eventWineRatings", "event-1"])).toEqual([
      { wine_id: "wine-3", thumbs_up: 1 },
    ]);
    expect(queryClient.getQueryData(["eventWineTagSummary", "event-1"])).toEqual([
      { wine_id: "wine-3", tag: "oak" },
    ]);

    restoreRemovedWineCache(queryClient, snapshot);

    expect(queryClient.getQueryData(["wine", "wine-1"])).toEqual(wine);
    expect(queryClient.getQueryData(["cellar", "my-wines", "member-1"])).toEqual(cellarList);
    expect(queryClient.getQueryData(["wines", "event-1"])).toEqual(eventList);
    expect(queryClient.getQueryData(["event_rating_summary", "event-1"])).toEqual(ratingSummary);
    expect(queryClient.getQueryData(["eventWineRatings", "event-1"])).toEqual(ratingSummary);
    expect(queryClient.getQueryData(["eventWineTagSummary", "event-1"])).toEqual(tagSummary);
  });
});
