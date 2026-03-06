// Supabase Edge Function: generate-bottle-image
// PRD-2026-007: AI-Enhanced Wine Bottle Image Generation
// Uses Google Gemini Flash 2.0 to produce polished bottle renders from user scans.
//
// Pipeline:
//   1. Score raw scan quality (0-100) via Gemini vision
//   2. Mode selection: >=75 restoration, 40-74 grounded generation, <40 raw fallback
//   3. Call Gemini image generation with brand-consistent prompt + reference image
//   4. OCR validation: reject if key label text appears to have drifted
//   5. Upload generated image to Supabase Storage
//   6. Return display_photo_url + metadata; fallback silently on any error

import * as jose from "npm:jose";
import { createClient } from "npm:@supabase/supabase-js@2";

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";
const GEMINI_FLASH = "gemini-2.0-flash-exp";
const LABEL_PHOTOS_BUCKET = "label-photos";
const PROMPT_VERSION = "1.0";

// ─── Brand prompt constants (mirrors config/image-generation-prompts.ts) ────

const BRAND_SCAFFOLD =
  "premium wine product photography, warm natural golden hour light, elegant editorial feel, " +
  "soft shadows, shallow depth of field, subtle glass reflections, minimal background distraction, " +
  "heritage-luxury tone";

const SCENE_CONSTRAINTS =
  "neutral warm background (rustic stone or light oak wooden table), refined surface texture, " +
  "centered or slightly angled hero composition, 3:4 aspect ratio, optimized for mobile display";

const NEGATIVE_CONSTRAINTS =
  "do not redesign label, do not invent medals or awards, do not alter typography, " +
  "do not change vintage, do not add extra bottles, do not introduce fake winery scenery, " +
  "no watermarks, no text overlays";

const RESTORATION_PROMPT =
  "Clean and relight this wine bottle photograph to create a polished product shot. " +
  "Remove glare, correct white balance, normalize exposure, and soften the background. " +
  "Preserve ALL label text, layout, colors, and design elements exactly as they appear. " +
  `Style: ${BRAND_SCAFFOLD}. Scene: ${SCENE_CONSTRAINTS}. Constraints: ${NEGATIVE_CONSTRAINTS}.`;

const QUALITY_SCORING_PROMPT =
  "Analyze this wine bottle label photo and rate its quality for image enhancement. " +
  "Consider: label visibility (0-30pts), focus/sharpness (0-25pts), lighting quality (0-25pts), " +
  "absence of glare/reflections (0-20pts). " +
  'Return ONLY a JSON object: { "score": <integer 0-100>, "issues": [<string>] }';

function buildGenerationPrompt(extraction: ExtractionMetadata): string {
  const colorDesc =
    extraction.color === "red"
      ? "red wine"
      : extraction.color === "white"
      ? "white wine"
      : extraction.color === "skin-contact"
      ? "rosé/orange wine"
      : "wine";
  const sparklingDesc = extraction.is_sparkling ? " (sparkling)" : "";
  const bottleDesc = [
    extraction.producer,
    extraction.varietal,
    extraction.vintage ? String(extraction.vintage) : null,
    extraction.region ? `from ${extraction.region}` : null,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    `Generate a professional product photograph of a ${colorDesc}${sparklingDesc} bottle. ` +
    `Wine: ${bottleDesc || "unknown wine"}. ` +
    `Use the provided reference image to faithfully reproduce the exact label design, typography, ` +
    `color palette, capsule/foil, and bottle silhouette — do not invent or alter any label details. ` +
    `Style: ${BRAND_SCAFFOLD}. Scene: ${SCENE_CONSTRAINTS}. Constraints: ${NEGATIVE_CONSTRAINTS}.`
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface ExtractionMetadata {
  producer?: string | null;
  varietal?: string | null;
  vintage?: number | null;
  region?: string | null;
  color?: "red" | "white" | "skin-contact" | null;
  is_sparkling?: boolean | null;
}

interface ReqBody {
  wine_id?: string | null; // optional: only used for error logging; omit when wine not yet saved
  raw_image_url: string;
  extraction_metadata: ExtractionMetadata;
}

interface GenerateResult {
  display_photo_url: string;
  confidence_score: number;
  generation_status: "generated" | "fallback_raw" | "failed";
  metadata: {
    mode: "restoration" | "grounded_generation" | "fallback_raw";
    model_id: string;
    prompt_version: string;
    latency_ms: number;
    issues?: string[];
  };
}

interface SupabaseStorageClient {
  storage: {
    from(bucket: string): {
      upload(
        path: string,
        body: Uint8Array,
        opts: { contentType: string; upsert: boolean }
      ): Promise<{ data: { path: string }; error: { message: string } | null }>;
      getPublicUrl(path: string): { data: { publicUrl: string } };
    };
  };
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

async function verifyAuth(req: Request): Promise<Response | null> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return jsonResponse({ error: "Missing or invalid Authorization header" }, 401);
  }
  const token = authHeader.slice(7).trim();
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  if (!supabaseUrl) return jsonResponse({ error: "Server configuration error" }, 500);
  const issuer = Deno.env.get("SB_JWT_ISSUER") ?? `${supabaseUrl}/auth/v1`;
  const jwksUrl = new URL(`${supabaseUrl}/auth/v1/.well-known/jwks.json`);
  try {
    const JWKS = jose.createRemoteJWKSet(jwksUrl);
    await jose.jwtVerify(token, JWKS, { issuer });
    return null;
  } catch (e) {
    console.warn("generate-bottle-image: JWT verification failed", e);
    return jsonResponse({ error: "Invalid JWT" }, 401);
  }
}

// ─── Gemini helpers ───────────────────────────────────────────────────────────

async function geminiVision(apiKey: string, imageUrl: string, prompt: string): Promise<string> {
  const res = await fetch(
    `${GEMINI_BASE}/models/${GEMINI_FLASH}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: prompt },
              { inline_data: { mime_type: "image/jpeg", data: await urlToBase64(imageUrl) } },
            ],
          },
        ],
        generationConfig: { temperature: 0.1, maxOutputTokens: 256 },
      }),
    }
  );
  if (!res.ok) throw new Error(`Gemini vision error ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
  return data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
}

async function geminiGenerateImage(
  apiKey: string,
  imageUrl: string,
  prompt: string
): Promise<Uint8Array | null> {
  // Gemini 2.0 Flash Experimental supports image generation via the standard generateContent endpoint
  // with responseModalities including "IMAGE"
  const res = await fetch(
    `${GEMINI_BASE}/models/${GEMINI_FLASH}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: prompt },
              { inline_data: { mime_type: "image/jpeg", data: await urlToBase64(imageUrl) } },
            ],
          },
        ],
        generationConfig: {
          responseModalities: ["IMAGE", "TEXT"],
          temperature: 0.4,
        },
      }),
    }
  );
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini image gen error ${res.status}: ${errText.slice(0, 200)}`);
  }
  const data = await res.json() as {
    candidates?: Array<{
      content?: { parts?: Array<{ inlineData?: { mimeType: string; data: string }; text?: string }> };
    }>;
  };
  const parts = data?.candidates?.[0]?.content?.parts ?? [];
  for (const part of parts) {
    if (part.inlineData?.data) {
      return base64ToUint8Array(part.inlineData.data);
    }
  }
  return null;
}

// ─── Image helpers ────────────────────────────────────────────────────────────

async function urlToBase64(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch image: ${res.status}`);
  const buf = await res.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToUint8Array(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

// ─── Storage upload ───────────────────────────────────────────────────────────

async function uploadDisplayPhoto(imageBytes: Uint8Array): Promise<string | null> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) return null;
  const supabase = createClient(supabaseUrl, serviceRoleKey) as SupabaseStorageClient;
  const path = `${crypto.randomUUID()}_display.jpg`;
  const { data, error } = await supabase.storage
    .from(LABEL_PHOTOS_BUCKET)
    .upload(path, imageBytes, { contentType: "image/jpeg", upsert: false });
  if (error) {
    console.error("generate-bottle-image: storage upload failed", error.message);
    return null;
  }
  const { data: urlData } = supabase.storage.from(LABEL_PHOTOS_BUCKET).getPublicUrl(data.path);
  return urlData.publicUrl;
}

// ─── Error logging ────────────────────────────────────────────────────────────

async function logError(wineId: string | null | undefined, errorType: string, details: Record<string, unknown>): Promise<void> {
  if (!wineId) return; // skip logging if wine not yet saved
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) return;
    const supabase = createClient(supabaseUrl, serviceRoleKey) as {
      from(table: string): { insert(data: unknown): Promise<{ error: unknown }> };
    };
    await supabase.from("image_generation_errors").insert({
      wine_id: wineId,
      error_type: errorType,
      error_details: details,
    });
  } catch {
    // non-critical; swallow
  }
}

// ─── OCR validation ───────────────────────────────────────────────────────────

function levenshteinDistance(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

function ocrDriftExceeds(original: string, subject: string, threshold = 0.15): boolean {
  if (!original || !subject) return false;
  const a = original.toLowerCase().trim();
  const b = subject.toLowerCase().trim();
  const dist = levenshteinDistance(a, b);
  return dist / Math.max(a.length, 1) > threshold;
}

async function validateOcr(
  apiKey: string,
  generatedImageBytes: Uint8Array,
  extraction: ExtractionMetadata
): Promise<boolean> {
  try {
    const b64 = btoa(String.fromCharCode(...generatedImageBytes));
    const res = await fetch(
      `${GEMINI_BASE}/models/${GEMINI_FLASH}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text:
                    "Read the label text on this wine bottle. " +
                    'Return ONLY a JSON object: { "producer": "<text or null>", "vintage": "<text or null>" }',
                },
                { inline_data: { mime_type: "image/jpeg", data: b64 } },
              ],
            },
          ],
          generationConfig: { temperature: 0.0, maxOutputTokens: 128 },
        }),
      }
    );
    if (!res.ok) return true; // can't validate; allow
    const data = await res.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
    const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    const jsonStr = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
    const parsed = JSON.parse(jsonStr) as { producer?: string | null; vintage?: string | null };

    if (extraction.producer && parsed.producer) {
      if (ocrDriftExceeds(extraction.producer, parsed.producer)) {
        console.warn("generate-bottle-image: OCR validation failed for producer");
        return false;
      }
    }
    if (extraction.vintage && parsed.vintage) {
      const expectedVintage = String(extraction.vintage);
      if (!parsed.vintage.includes(expectedVintage)) {
        console.warn("generate-bottle-image: OCR validation failed for vintage");
        return false;
      }
    }
    return true;
  } catch (e) {
    console.warn("generate-bottle-image: OCR validation error (allowing)", e);
    return true; // validation failure is non-fatal; allow
  }
}

// ─── Main handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders() });
  }

  const authError = await verifyAuth(req);
  if (authError) return authError;

  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) {
    console.error("generate-bottle-image: GEMINI_API_KEY not configured");
    return jsonResponse({ error: "GEMINI_API_KEY not configured" }, 500);
  }

  let body: ReqBody;
  try {
    body = (await req.json()) as ReqBody;
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  if (!body.raw_image_url) {
    return jsonResponse({ error: "raw_image_url is required" }, 400);
  }

  const startMs = Date.now();
  const { wine_id, raw_image_url, extraction_metadata } = body;

  try {
    // ── Step 1: Score raw scan quality ────────────────────────────────────────
    let confidenceScore = 60; // default to mid-range if scoring fails
    let qualityIssues: string[] = [];

    try {
      const scoreText = await geminiVision(apiKey, raw_image_url, QUALITY_SCORING_PROMPT);
      const scoreJson = scoreText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
      const parsed = JSON.parse(scoreJson) as { score?: number; issues?: string[] };
      if (typeof parsed.score === "number") confidenceScore = Math.max(0, Math.min(100, parsed.score));
      if (Array.isArray(parsed.issues)) qualityIssues = parsed.issues;
    } catch (e) {
      console.warn("generate-bottle-image: quality scoring failed, using default", e);
    }

    console.log(`generate-bottle-image: wine=${wine_id} score=${confidenceScore}`);

    // ── Step 2: Mode selection — fallback raw if confidence too low ───────────
    if (confidenceScore < 40) {
      const result: GenerateResult = {
        display_photo_url: raw_image_url,
        confidence_score: confidenceScore,
        generation_status: "fallback_raw",
        metadata: {
          mode: "fallback_raw",
          model_id: GEMINI_FLASH,
          prompt_version: PROMPT_VERSION,
          latency_ms: Date.now() - startMs,
          issues: qualityIssues,
        },
      };
      return jsonResponse(result);
    }

    // ── Step 3: Generate image ────────────────────────────────────────────────
    const mode = confidenceScore >= 75 ? "restoration" : "grounded_generation";
    const prompt =
      mode === "restoration"
        ? RESTORATION_PROMPT
        : buildGenerationPrompt(extraction_metadata);

    const imageBytes = await geminiGenerateImage(apiKey, raw_image_url, prompt);

    if (!imageBytes) {
      console.warn("generate-bottle-image: Gemini returned no image bytes, falling back");
      await logError(wine_id, "no_image_bytes", { mode, confidence_score: confidenceScore });
      return jsonResponse<GenerateResult>({
        display_photo_url: raw_image_url,
        confidence_score: confidenceScore,
        generation_status: "fallback_raw",
        metadata: { mode: "fallback_raw", model_id: GEMINI_FLASH, prompt_version: PROMPT_VERSION, latency_ms: Date.now() - startMs },
      });
    }

    // ── Step 4: OCR validation ────────────────────────────────────────────────
    const ocrValid = await validateOcr(apiKey, imageBytes, extraction_metadata);
    if (!ocrValid) {
      console.warn("generate-bottle-image: OCR validation failed, falling back to raw");
      await logError(wine_id, "ocr_validation_failed", { mode, confidence_score: confidenceScore });
      return jsonResponse<GenerateResult>({
        display_photo_url: raw_image_url,
        confidence_score: confidenceScore,
        generation_status: "fallback_raw",
        metadata: { mode: "fallback_raw", model_id: GEMINI_FLASH, prompt_version: PROMPT_VERSION, latency_ms: Date.now() - startMs },
      });
    }

    // ── Step 5: Upload to storage ─────────────────────────────────────────────
    const displayPhotoUrl = await uploadDisplayPhoto(imageBytes);
    if (!displayPhotoUrl) {
      console.warn("generate-bottle-image: upload failed, falling back to raw");
      await logError(wine_id, "upload_failed", { mode, confidence_score: confidenceScore });
      return jsonResponse<GenerateResult>({
        display_photo_url: raw_image_url,
        confidence_score: confidenceScore,
        generation_status: "fallback_raw",
        metadata: { mode: "fallback_raw", model_id: GEMINI_FLASH, prompt_version: PROMPT_VERSION, latency_ms: Date.now() - startMs },
      });
    }

    const latencyMs = Date.now() - startMs;
    console.log(`generate-bottle-image: success wine=${wine_id} mode=${mode} latency=${latencyMs}ms`);

    return jsonResponse<GenerateResult>({
      display_photo_url: displayPhotoUrl,
      confidence_score: confidenceScore,
      generation_status: "generated",
      metadata: {
        mode,
        model_id: GEMINI_FLASH,
        prompt_version: PROMPT_VERSION,
        latency_ms: latencyMs,
        issues: qualityIssues.length ? qualityIssues : undefined,
      },
    });
  } catch (e) {
    console.error("generate-bottle-image: unhandled error", e);
    await logError(wine_id, "unhandled_error", {
      message: e instanceof Error ? e.message : String(e),
    });
    return jsonResponse<GenerateResult>({
      display_photo_url: raw_image_url,
      confidence_score: 0,
      generation_status: "failed",
      metadata: {
        mode: "fallback_raw",
        model_id: GEMINI_FLASH,
        prompt_version: PROMPT_VERSION,
        latency_ms: Date.now() - startMs,
      },
    });
  }
});

function corsHeaders(): Record<string, string> {
  const origin = Deno.env.get("APP_URL") || "https://phina.appsmithery.co";
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}

function jsonResponse<T>(body: T, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders() },
  });
}
