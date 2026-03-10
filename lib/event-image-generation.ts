import { supabase } from "@/lib/supabase";

interface EventImageMetadata {
  latency_ms: number;
  model_id: string;
  prompt_version: string;
  image_generation_attempts?: Array<{
    model_id: string;
    latency_ms: number;
    retryable: boolean;
    message: string;
  }>;
}

interface EventImageSuccessResult {
  ok: true;
  event_image_url: string | null;
  event_image_status: "generated";
  metadata?: EventImageMetadata;
}

export interface EventImageFailureResult {
  ok: false;
  event_image_url: string | null;
  event_image_status: "failed";
  failure_reason: string;
  error: string;
  metadata?: EventImageMetadata;
}

export type EventImageResult = EventImageSuccessResult | EventImageFailureResult;

interface EventImageFunctionResponse {
  event_image_url: string | null;
  event_image_status: "generated" | "failed";
  failure_reason?: string;
  error?: string;
  metadata?: EventImageMetadata;
}

export function getEventImageErrorMessage(failureReason: string, fallbackError?: string): string {
  switch (failureReason) {
    case "rate_limited":
      return "Hero image generation is temporarily unavailable. Try again in a few minutes.";
    case "provider_unavailable":
      return "Hero image generation is temporarily unavailable. Try again shortly.";
    case "model_unavailable":
      return "Hero image generation is temporarily unavailable right now. Try again later.";
    case "storage_upload_failed":
      return "The hero image was generated but could not be saved. Try again.";
    case "missing_gemini_api_key":
      return "Hero image generation is not configured yet.";
    case "invoke_error":
      return "Could not reach hero image generation. Try again.";
    default: {
      const normalized = fallbackError?.toLowerCase() ?? "";
      if (normalized.includes("resource_exhausted") || normalized.includes("rate limit") || normalized.includes("429")) {
        return "Hero image generation is temporarily unavailable. Try again in a few minutes.";
      }
      return "Hero image generation failed. Try again later.";
    }
  }
}

export async function generateEventImage(
  eventId: string,
  title: string,
  theme: string | null,
  description: string | null
): Promise<EventImageResult> {
  try {
    const { data, error } = await supabase.functions.invoke("generate-event-image", {
      body: {
        event_id: eventId,
        title,
        theme,
        description,
      },
    });

    if (error) {
      console.warn("[event-image] edge function error:", { eventId, error });
      await supabase.from("events").update({ event_image_status: "failed" }).eq("id", eventId);
      return {
        ok: false,
        event_image_url: null,
        event_image_status: "failed",
        failure_reason: "invoke_error",
        error: getEventImageErrorMessage("invoke_error", error.message),
      };
    }

    const result = data as EventImageFunctionResponse | null;
    if (result?.event_image_status === "generated") {
      return {
        ok: true,
        event_image_url: result.event_image_url ?? null,
        event_image_status: "generated",
        metadata: result.metadata,
      };
    }

    return {
      ok: false,
      event_image_url: result?.event_image_url ?? null,
      event_image_status: "failed",
      failure_reason: result?.failure_reason ?? "generation_failed",
      error: getEventImageErrorMessage(result?.failure_reason ?? "generation_failed", result?.error),
      metadata: result?.metadata,
    };
  } catch (error) {
    console.warn("[event-image] unexpected invoke error:", { eventId, error });
    await supabase.from("events").update({ event_image_status: "failed" }).eq("id", eventId);
    return {
      ok: false,
      event_image_url: null,
      event_image_status: "failed",
      failure_reason: "unexpected_error",
      error: getEventImageErrorMessage(
        "unexpected_error",
        error instanceof Error ? error.message : "Unexpected event image generation error."
      ),
    };
  }
}
