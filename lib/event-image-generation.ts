import { supabase } from "@/lib/supabase";

interface EventImageResult {
  event_image_url: string | null;
  event_image_status: "generated" | "failed";
  metadata?: {
    model_id: string;
    prompt_version: string;
    latency_ms: number;
    image_generation_attempts?: Array<{
      model_id: string;
      latency_ms: number;
      retryable: boolean;
      message: string;
    }>;
  };
}

export async function generateEventImage(
  eventId: string,
  title: string,
  theme: string | null,
  description: string | null
): Promise<EventImageResult | null> {
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
      return null;
    }

    return (data as EventImageResult | null) ?? null;
  } catch (error) {
    console.warn("[event-image] unexpected invoke error:", { eventId, error });
    await supabase.from("events").update({ event_image_status: "failed" }).eq("id", eventId);
    return null;
  }
}
