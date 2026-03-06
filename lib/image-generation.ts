// Client helper for invoking the generate-bottle-image edge function.
// Returns the display_photo_url and generation status; never throws.

import { supabase } from "@/lib/supabase";
import type { WineExtraction } from "@/lib/last-label-extraction";

export interface BottleImageResult {
  display_photo_url: string | null;
  confidence_score: number;
  generation_status: "generated" | "fallback_raw" | "failed";
  metadata?: {
    mode: string;
    model_id: string;
    prompt_version: string;
    latency_ms: number;
    issues?: string[];
  };
}

export async function generateBottleImage(
  wineId: string,
  rawImageUrl: string,
  extraction: Pick<WineExtraction, "producer" | "varietal" | "vintage" | "region" | "color" | "is_sparkling">
): Promise<BottleImageResult> {
  try {
    const { data, error } = await supabase.functions.invoke("generate-bottle-image", {
      body: {
        wine_id: wineId,
        raw_image_url: rawImageUrl,
        extraction_metadata: {
          producer: extraction.producer,
          varietal: extraction.varietal,
          vintage: extraction.vintage,
          region: extraction.region,
          color: extraction.color,
          is_sparkling: extraction.is_sparkling,
        },
      },
    });

    if (error) {
      console.warn("[image-generation] edge function error:", error);
      return { display_photo_url: rawImageUrl, confidence_score: 0, generation_status: "failed" };
    }

    const result = data as BottleImageResult;
    return {
      display_photo_url: result?.display_photo_url ?? rawImageUrl,
      confidence_score: result?.confidence_score ?? 0,
      generation_status: result?.generation_status ?? "failed",
      metadata: result?.metadata,
    };
  } catch (e) {
    console.warn("[image-generation] unexpected error:", e);
    return { display_photo_url: rawImageUrl, confidence_score: 0, generation_status: "failed" };
  }
}
