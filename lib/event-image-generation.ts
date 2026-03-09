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
        error: error.message ?? "Could not reach the event image function.",
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
      error: result?.error ?? "Hero image generation failed.",
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
      error: error instanceof Error ? error.message : "Unexpected event image generation error.",
    };
  }
}
