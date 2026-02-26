// In-memory store for label extraction result when navigating from scan-label back to add-wine.
// Cleared after add-wine consumes it.

export interface WineExtraction {
  producer: string | null;
  varietal: string | null;
  vintage: number | null;
  region: string | null;
  ai_summary: string | null;
  label_photo_url: string | null;
  color: "red" | "white" | "skin-contact" | null;
  is_sparkling: boolean | null;
  ai_overview: string | null;
  ai_geography: string | null;
  ai_production: string | null;
  ai_tasting_notes: string | null;
  ai_pairings: string | null;
  drink_from: number | null;
  drink_until: number | null;
}

let last: WineExtraction | null = null;

export function setLastLabelExtraction(extraction: WineExtraction | null): void {
  last = extraction;
}

export function takeLastLabelExtraction(): WineExtraction | null {
  const v = last;
  last = null;
  return v;
}
