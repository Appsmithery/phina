import type { QueryClient } from "@tanstack/react-query";

import { generateBottleImage } from "@/lib/image-generation";
import type { WineExtraction } from "@/lib/last-label-extraction";
import { supabase } from "@/lib/supabase";

interface EnhanceBottleImageParams {
  wineId: string;
  memberId: string;
  eventId?: string | null;
  rawImageUrl: string;
  extraction: Pick<WineExtraction, "producer" | "varietal" | "vintage" | "region" | "color" | "is_sparkling">;
  queryClient: QueryClient;
}

export function enhanceBottleImageInBackground({
  wineId,
  memberId,
  eventId = null,
  rawImageUrl,
  extraction,
  queryClient,
}: EnhanceBottleImageParams): void {
  (async () => {
    try {
      const result = await generateBottleImage(wineId, rawImageUrl, extraction);
      const { error: patchError } = await supabase
        .from("wines")
        .update({
          display_photo_url: result.display_photo_url ?? rawImageUrl,
          image_confidence_score: result.confidence_score,
          image_generation_status: result.generation_status,
          image_generation_metadata: result.metadata ?? null,
        })
        .eq("id", wineId);

      if (patchError) {
        if (__DEV__) console.warn("[bottle-image] patch bottle image fields error:", patchError);
        return;
      }

      if (__DEV__) console.log("[bottle-image] background bottle image complete for", wineId);
    } catch (e) {
      if (__DEV__) console.warn("[bottle-image] enhanceBottleImageInBackground error:", e);
      const { error: patchError } = await supabase
        .from("wines")
        .update({
          display_photo_url: rawImageUrl,
          image_confidence_score: 0,
          image_generation_status: "failed",
          image_generation_metadata: null,
        })
        .eq("id", wineId);
      if (patchError && __DEV__) {
        console.warn("[bottle-image] patch bottle image failure status error:", patchError);
      }
    } finally {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["wine", wineId] }),
        queryClient.invalidateQueries({ queryKey: ["cellar", "my-wines", memberId] }),
        ...(eventId ? [queryClient.invalidateQueries({ queryKey: ["wines", eventId] })] : []),
      ]);
    }
  })();
}
