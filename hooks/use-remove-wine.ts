import { QueryClient, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

type WineListItem = { id: string };
type WineSummaryListItem = { wine_id: string };

type RemoveWineParams = {
  wineId: string;
  memberId?: string | null;
  eventId?: string | null;
};

type CachedQuerySnapshot = {
  queryKey: readonly unknown[];
  data: unknown;
};

export type RemoveWineCacheSnapshot = {
  snapshots: CachedQuerySnapshot[];
};

function removeWineFromList<T extends WineListItem>(items: T[] | undefined, wineId: string) {
  if (!Array.isArray(items)) return items;
  return items.filter((item) => item.id !== wineId);
}

function removeWineFromSummaryList<T extends WineSummaryListItem>(items: T[] | undefined, wineId: string) {
  if (!Array.isArray(items)) return items;
  return items.filter((item) => item.wine_id !== wineId);
}

function cacheSnapshot(queryClient: QueryClient, queryKey: readonly unknown[]) {
  return {
    queryKey,
    data: queryClient.getQueryData(queryKey),
  };
}

export function applyOptimisticWineRemoval(
  queryClient: QueryClient,
  { wineId, memberId, eventId }: RemoveWineParams,
): RemoveWineCacheSnapshot {
  const snapshots: CachedQuerySnapshot[] = [];
  const wineQueryKey = ["wine", wineId] as const;

  snapshots.push(cacheSnapshot(queryClient, wineQueryKey));
  queryClient.setQueryData(wineQueryKey, null);

  if (memberId) {
    const cellarQueryKey = ["cellar", "my-wines", memberId] as const;
    snapshots.push(cacheSnapshot(queryClient, cellarQueryKey));
    queryClient.setQueryData(cellarQueryKey, (current: WineListItem[] | undefined) =>
      removeWineFromList(current, wineId),
    );
  }

  if (eventId) {
    const eventWinesQueryKey = ["wines", eventId] as const;
    const eventRatingSummaryQueryKey = ["event_rating_summary", eventId] as const;
    const eventWineRatingsQueryKey = ["eventWineRatings", eventId] as const;
    const eventWineTagSummaryQueryKey = ["eventWineTagSummary", eventId] as const;

    snapshots.push(
      cacheSnapshot(queryClient, eventWinesQueryKey),
      cacheSnapshot(queryClient, eventRatingSummaryQueryKey),
      cacheSnapshot(queryClient, eventWineRatingsQueryKey),
      cacheSnapshot(queryClient, eventWineTagSummaryQueryKey),
    );

    queryClient.setQueryData(eventWinesQueryKey, (current: WineListItem[] | undefined) =>
      removeWineFromList(current, wineId),
    );
    queryClient.setQueryData(eventRatingSummaryQueryKey, (current: WineSummaryListItem[] | undefined) =>
      removeWineFromSummaryList(current, wineId),
    );
    queryClient.setQueryData(eventWineRatingsQueryKey, (current: WineSummaryListItem[] | undefined) =>
      removeWineFromSummaryList(current, wineId),
    );
    queryClient.setQueryData(eventWineTagSummaryQueryKey, (current: WineSummaryListItem[] | undefined) =>
      removeWineFromSummaryList(current, wineId),
    );
  }

  return { snapshots };
}

export function restoreRemovedWineCache(queryClient: QueryClient, snapshot: RemoveWineCacheSnapshot | undefined) {
  if (!snapshot) return;
  snapshot.snapshots.forEach(({ queryKey, data }) => {
    queryClient.setQueryData(queryKey, data);
  });
}

export function useRemoveWine({ wineId, memberId, eventId }: RemoveWineParams) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("wines").delete().eq("id", wineId);
      if (error) throw error;
    },
    onMutate: async () => {
      const queryKeys: Array<readonly unknown[] | null> = [
        ["wine", wineId],
        memberId ? ["cellar", "my-wines", memberId] : null,
        eventId ? ["wines", eventId] : null,
        eventId ? ["event_rating_summary", eventId] : null,
        eventId ? ["eventWineRatings", eventId] : null,
        eventId ? ["eventWineTagSummary", eventId] : null,
      ];
      const activeQueryKeys = queryKeys.filter((queryKey): queryKey is readonly unknown[] => queryKey !== null);

      await Promise.all(activeQueryKeys.map((queryKey) => queryClient.cancelQueries({ queryKey })));
      return applyOptimisticWineRemoval(queryClient, { wineId, memberId, eventId });
    },
    onError: (_error, _variables, context) => {
      restoreRemovedWineCache(queryClient, context);
    },
    onSettled: async () => {
      const invalidations = [
        queryClient.invalidateQueries({ queryKey: ["wine", wineId] }),
        memberId
          ? queryClient.invalidateQueries({ queryKey: ["cellar", "my-wines", memberId] })
          : Promise.resolve(),
        eventId ? queryClient.invalidateQueries({ queryKey: ["wines", eventId] }) : Promise.resolve(),
        eventId
          ? queryClient.invalidateQueries({ queryKey: ["event_rating_summary", eventId] })
          : Promise.resolve(),
        eventId
          ? queryClient.invalidateQueries({ queryKey: ["eventWineRatings", eventId] })
          : Promise.resolve(),
        eventId
          ? queryClient.invalidateQueries({ queryKey: ["eventWineTagSummary", eventId] })
          : Promise.resolve(),
      ];

      await Promise.all(invalidations);
    },
  });
}
