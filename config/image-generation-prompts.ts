export interface BottlePayload {
  producer: string | null;
  varietal: string | null;
  vintage: number | null;
  region: string | null;
  color: "red" | "white" | "skin-contact" | null;
  is_sparkling?: boolean | null;
}

export interface EventImagePayload {
  title: string;
  theme: string | null;
  description: string | null;
}

export const BRAND_SCAFFOLD =
  "premium wine product photography, warm natural golden hour light, elegant editorial feel, " +
  "soft shadows, shallow depth of field, subtle glass reflections, minimal background distraction, " +
  "heritage-luxury tone";

export const SCENE_CONSTRAINTS =
  "neutral warm background (rustic stone or light oak wooden table), refined surface texture, " +
  "centered or slightly angled hero composition, 3:4 aspect ratio, optimized for mobile display";

export const NEGATIVE_CONSTRAINTS =
  "do not redesign label, do not invent medals or awards, do not alter typography, " +
  "do not change vintage, do not add extra bottles, do not introduce fake winery scenery, " +
  "no watermarks, no text overlays";

export const RESTORATION_PROMPT =
  "Clean and relight this wine bottle photograph to create a polished product shot. " +
  "Remove glare, correct white balance, normalize exposure, and soften the background. " +
  "Preserve ALL label text, layout, colors, and design elements exactly as they appear. " +
  "Do not alter the bottle shape, capsule color, or any label content. " +
  `Style: ${BRAND_SCAFFOLD}. Scene: ${SCENE_CONSTRAINTS}. Constraints: ${NEGATIVE_CONSTRAINTS}.`;

export function buildBottlePrompt(bottle: BottlePayload): string {
  const colorDesc =
    bottle.color === "red"
      ? "red wine"
      : bottle.color === "white"
        ? "white wine"
        : bottle.color === "skin-contact"
          ? "rose/orange wine"
          : "wine";

  const sparklingDesc = bottle.is_sparkling ? " (sparkling)" : "";
  const bottleDesc = [
    bottle.producer,
    bottle.varietal,
    bottle.vintage ? String(bottle.vintage) : null,
    bottle.region ? `from ${bottle.region}` : null,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    `Generate a professional product photograph of a ${colorDesc}${sparklingDesc} bottle. ` +
    `Wine: ${bottleDesc || "unknown wine"}. ` +
    "Use the provided reference image to faithfully reproduce the exact label design, typography, " +
    "color palette, capsule/foil, and bottle silhouette - do not invent or alter any label details. " +
    `Style: ${BRAND_SCAFFOLD}. Scene: ${SCENE_CONSTRAINTS}. Constraints: ${NEGATIVE_CONSTRAINTS}.`
  );
}

export const QUALITY_SCORING_PROMPT =
  "Analyze this wine bottle label photo and rate its quality for image enhancement. " +
  "Consider: label visibility (0-30pts), focus/sharpness (0-25pts), lighting quality (0-25pts), " +
  "absence of glare/reflections (0-20pts). " +
  'Return ONLY a JSON object: { "score": <integer 0-100>, "issues": [<string>] }';

export const EVENT_BRAND_SCAFFOLD =
  "warm editorial photography, golden hour ambient lighting, elegant entertaining atmosphere, " +
  "rich textures, soft bokeh, heritage-luxury tone";

export const EVENT_SCENE_CONSTRAINTS =
  "4:3 aspect ratio, optimized for mobile card display, inviting depth";

export function buildEventImagePrompt(title: string, theme: string | null, description: string | null): string {
  const normalizedTitle = sanitizePromptField(title, 100) ?? "Wine tasting";
  const normalizedTheme = sanitizePromptField(theme, 80);
  const normalizedDescription = sanitizePromptField(description, 220);
  const themeSentence = normalizedTheme ? `Theme: ${normalizedTheme}. ` : "";
  const descriptionSentence = normalizedDescription ? `Description: ${normalizedDescription}. ` : "";

  return (
    `Generate an elegant editorial photograph for a wine tasting event titled "${normalizedTitle}". ` +
    themeSentence +
    descriptionSentence +
    "Show an inviting, atmospheric wine event scene - think candlelit table settings, " +
    "curated wine glasses, warm ambient lighting, stylish venue details. " +
    `Style: ${EVENT_BRAND_SCAFFOLD}. Scene: ${EVENT_SCENE_CONSTRAINTS}. ` +
    "No text, no logos, no watermarks, no people's faces."
  );
}

function sanitizePromptField(value: string | null | undefined, maxLength: number): string | null {
  const normalized = value?.replace(/\s+/g, " ").trim();
  if (!normalized) return null;
  return normalized.slice(0, maxLength);
}
