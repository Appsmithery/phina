import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Platform } from "react-native";
import { supabase } from "@/lib/supabase";
import { showAlert } from "@/lib/alert";
import { trackEvent } from "@/lib/observability";

type PushSendResponse = {
  sent?: number;
  expo_recipients?: number;
  web_recipients?: number;
  expo_sent?: number;
  web_sent?: number;
  skipped_reason?: string | null;
  error?: string;
  error_code?: string;
};

type EventRoundConfig = {
  default_rating_window_minutes: 5 | 10 | 15;
};

function getTrackingErrorProps(error: unknown) {
  if (error && typeof error === "object") {
    const errorRecord = error as { code?: unknown; name?: unknown; message?: unknown };
    const errorCode = typeof errorRecord.code === "string"
      ? errorRecord.code
      : typeof errorRecord.name === "string"
        ? errorRecord.name
        : "unknown_error";
    const errorMessage = typeof errorRecord.message === "string" ? errorRecord.message : "Unknown error";

    return { error_code: errorCode, error_message: errorMessage };
  }

  if (error instanceof Error) {
    return { error_code: error.name, error_message: error.message };
  }

  return { error_code: "unknown_error", error_message: "Unknown error" };
}

async function getPushFailureProps(error: unknown, response?: Response) {
  const props: Record<string, string | number | boolean | null> = { ...getTrackingErrorProps(error) };
  if (!response) return props;

  let payload: PushSendResponse | null = null;
  try {
    payload = await response.clone().json() as PushSendResponse;
  } catch {
    payload = null;
  }

  if (typeof response.status === "number") {
    props.http_status = response.status;
  }

  if (typeof payload?.error === "string" && payload.error.length > 0) {
    props.error_message = payload.error;
  }

  const responseErrorCode = typeof payload?.error_code === "string" ? payload.error_code : null;
  if (responseErrorCode) {
    props.error_code = responseErrorCode;
    return props;
  }

  if (response.status === 401) {
    props.error_code = "unauthorized";
  } else if (response.status === 403) {
    props.error_code = "forbidden";
  } else if (response.status === 404) {
    props.error_code = "wine_not_found";
  } else if (response.status >= 500) {
    props.error_code = "internal_error";
  }

  return props;
}

function getPushSuccessProps(result: PushSendResponse | null | undefined) {
  return {
    sent: typeof result?.sent === "number" ? result.sent : 0,
    expo_recipients: typeof result?.expo_recipients === "number" ? result.expo_recipients : 0,
    web_recipients: typeof result?.web_recipients === "number" ? result.web_recipients : 0,
    expo_sent: typeof result?.expo_sent === "number" ? result.expo_sent : 0,
    web_sent: typeof result?.web_sent === "number" ? result.web_sent : 0,
    skipped_reason: result?.skipped_reason ?? null,
  };
}

export function useStartRatingRound(
  eventId: string,
  wineId: string,
  durationMinutes: 5 | 10 | 15,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data: eventConfig, error: eventError } = await supabase
        .from("events")
        .select("default_rating_window_minutes")
        .eq("id", eventId)
        .single();
      if (eventError) throw eventError;

      const resolvedDuration =
        (eventConfig as EventRoundConfig | null)?.default_rating_window_minutes ??
        durationMinutes;

      const { error } = await supabase.from("rating_rounds").insert({
        event_id: eventId,
        wine_id: wineId,
        is_active: true,
        duration_minutes: resolvedDuration,
      });
      if (error) throw error;
      return resolvedDuration;
    },
    onSuccess: async (resolvedDuration) => {
      trackEvent("rating_round_started", {
        event_id: eventId,
        wine_id: wineId,
        duration_minutes: resolvedDuration,
        platform: Platform.OS,
        source: "host_controls",
        success: true,
      });
      qc.invalidateQueries({ queryKey: ["rating_rounds", eventId] });
      qc.invalidateQueries({ queryKey: ["ratingRound", eventId, wineId] });
      await qc.refetchQueries({ queryKey: ["rating_rounds", eventId] });
      await qc.refetchQueries({ queryKey: ["ratingRound", eventId, wineId] });
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const accessToken = session?.access_token;

      if (!accessToken) {
        trackEvent("rating_round_push_failed", {
          event_id: eventId,
          wine_id: wineId,
          duration_minutes: resolvedDuration,
          platform: Platform.OS,
          source: "host_controls",
          success: false,
          error_code: "missing_session",
          error_message: "No active session available for push invocation.",
        });
        showAlert(
          "Push notifications",
          `Round started and will close automatically in ${resolvedDuration} minutes, but we couldn't send push notifications. You can still share the link.`
        );
        return;
      }

      const { data, error, response } = await supabase.functions.invoke<PushSendResponse>("send-rating-round-push", {
        body: {
          event_id: eventId,
          wine_id: wineId,
          duration_minutes: resolvedDuration,
        },
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (__DEV__) {
        console.log("[send-rating-round-push] invoke result", { data, error, status: response?.status ?? null });
      }

      if (error) {
        trackEvent("rating_round_push_failed", {
          event_id: eventId,
          wine_id: wineId,
          duration_minutes: resolvedDuration,
          platform: Platform.OS,
          source: "host_controls",
          success: false,
          ...await getPushFailureProps(error, response),
        });
        console.warn("Push notification send failed:", error);
        showAlert(
          "Push notifications",
          `Round started and will close automatically in ${resolvedDuration} minutes, but we couldn't send push notifications. You can still share the link.`
        );
        return;
      }

      trackEvent("rating_round_push_sent", {
        event_id: eventId,
        wine_id: wineId,
        duration_minutes: resolvedDuration,
        platform: Platform.OS,
        source: "host_controls",
        success: true,
        ...getPushSuccessProps(data),
      });
      showAlert(
        "Round started",
        `Guests can rate this wine for the next ${resolvedDuration} minutes.`,
      );
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
      trackEvent("event_ended", { event_id: eventId, platform: Platform.OS, source: "host_controls" });
      qc.invalidateQueries({ queryKey: ["event", eventId] });
      qc.invalidateQueries({ queryKey: ["events"] });
    },
  });
}
