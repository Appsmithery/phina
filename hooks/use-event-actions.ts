import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export function useStartRatingRound(eventId: string, wineId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("rating_rounds").insert({
        event_id: eventId,
        wine_id: wineId,
        is_active: true,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rating_rounds", eventId] });
      qc.invalidateQueries({ queryKey: ["ratingRound", wineId] });
      supabase.functions.invoke("send-rating-round-push", {
        body: { event_id: eventId, wine_id: wineId },
      }).then(({ error }) => {
        if (error) console.warn("Push notification send failed:", error);
      });
    },
  });
}

export function useEndRatingRound(roundId: string, eventId: string, wineId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("rating_rounds")
        .update({ ended_at: new Date().toISOString(), is_active: false })
        .eq("id", roundId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rating_rounds", eventId] });
      qc.invalidateQueries({ queryKey: ["ratingRound", wineId] });
    },
  });
}

export function useEndEvent(eventId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("events")
        .update({ status: "ended" })
        .eq("id", eventId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["event", eventId] });
      qc.invalidateQueries({ queryKey: ["events"] });
    },
  });
}
