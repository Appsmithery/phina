import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { showAlert } from "@/lib/alert";
import { trackEvent } from "@/lib/observability";

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
    onSuccess: async () => {
      qc.invalidateQueries({ queryKey: ["rating_rounds", eventId] });
      qc.invalidateQueries({ queryKey: ["ratingRound", eventId, wineId] });
      await qc.refetchQueries({ queryKey: ["rating_rounds", eventId] });
      await qc.refetchQueries({ queryKey: ["ratingRound", eventId, wineId] });
      supabase.functions
        .invoke("send-rating-round-push", {
          body: { event_id: eventId, wine_id: wineId },
        })
        .then(({ data, error }) => {
          if (__DEV__) {
            console.log("[send-rating-round-push] invoke result", { data, error });
          }
          if (error) {
            console.warn("Push notification send failed:", error);
            showAlert(
              "Push notifications",
              "Round started, but we couldn't send push notifications. You can still share the link."
            );
          }
        })
        .catch((err) => {
          if (__DEV__) {
            console.warn("Push notification send failed:", err);
          }
          showAlert(
            "Push notifications",
            "Round started, but we couldn't send push notifications. You can still share the link."
          );
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
      qc.invalidateQueries({ queryKey: ["ratingRound", eventId, wineId] });
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
      trackEvent("event_ended", { event_id: eventId });
      qc.invalidateQueries({ queryKey: ["event", eventId] });
      qc.invalidateQueries({ queryKey: ["events"] });
    },
  });
}
