// In-memory store for label extraction result when navigating from scan-label back to add-wine.
// Cleared after add-wine consumes it.

export interface WineExtraction {
  producer: string | null;
  varietal: string | null;
  vintage: number | null;
  region: string | null;
  ai_summary: string | null;
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
