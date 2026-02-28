// Supabase Edge Function: extract wine label data using Perplexity Sonar (vision + structured output)
// Sonar provides: (1) OCR / vision over the label image, (2) web-grounded search for tasting notes and basic wine info in ai_summary.
// See https://docs.perplexity.ai/docs/sonar/quickstart and https://docs.perplexity.ai/docs/sonar/media
//
// Auth: When deployed with --no-verify-jwt (e.g. to work around gateway JWT verification issues),
// this function verifies the JWT itself using the project JWKS. When the gateway verifies JWT,
// the header is still present and this check passes.

import * as jose from "npm:jose";
import { createClient } from "npm:@supabase/supabase-js@2";

/** Minimal type for createClient result (deno-global.d.ts declares it as unknown). */
interface SupabaseStorageClient {
  storage: {
    from(bucket: string): {
      upload(path: string, body: Uint8Array, opts: { contentType: string; upsert: boolean }): Promise<{ data: { path: string }; error: { message: string } | null }>;
      getPublicUrl(path: string): { data: { publicUrl: string } };
    };
  };
}

const PERPLEXITY_URL = "https://api.perplexity.ai/chat/completions";
const MODEL = "sonar-pro";

const EXTRACTION_PROMPT = `You are a friendly wine guide writing for people who are new to wine and just starting to explore it.

Analyze the photo of a wine bottle label. Extract structured information from the label text, design, and your knowledge.

Tone rules (strictly follow these):
- Write in warm, conversational language as if recommending a wine to a curious friend.
- Briefly explain wine jargon (e.g. instead of "terroir" say "the land and climate it grows in").
- Every text field must be exactly 1-2 short sentences, maximum 40 words.
- Do NOT include citation references like [1], [2], etc. in any field.

Return a JSON object with exactly these keys (use null for missing/unclear values):
- producer: string (winery or producer name)
- varietal: string (e.g. Pinot Noir, Chardonnay)
- vintage: number or null (year)
- region: string (e.g. Burgundy, Napa Valley)
- color: "red", "white", or "skin-contact" (for rosé/orange wines). Infer from label color, varietal, or region if not explicit.
- is_sparkling: boolean (true if champagne, prosecco, cava, crémant, pét-nat, or any sparkling wine; false otherwise)
- ai_overview: string (1-2 sentences: who makes this wine and one fun fact or point of acclaim. Keep it conversational.)
- ai_geography: string (1-2 sentences: where it's from and what makes that place great for this style of wine. No jargon.)
- ai_production: string (1-2 sentences: how it's made in plain language. Briefly explain any technical terms used.)
- ai_tasting_notes: string (1-2 sentences: what it tastes and smells like, using everyday words like fruits, spices, or textures.)
- ai_pairings: string (1-2 sentences: specific food pairings a friend might suggest, like dishes or cuisines.)
- drink_from: number or null (the year this wine should start being at its best for drinking. For wines that are ready now, use the current year or the vintage year. For age-worthy wines, estimate when they'll hit their stride. Use null only if no vintage is available.)
- drink_until: number or null (the year by which this wine should ideally be consumed. Consider the varietal, region, and quality level. Light whites and rosés: 1-3 years from vintage. Bold reds and quality wines: 5-15+ years. Use null only if no vintage is available.)`;

const jsonSchema = {
  type: "object",
  properties: {
    producer: { type: ["string", "null"] },
    varietal: { type: ["string", "null"] },
    vintage: { type: ["integer", "null"] },
    region: { type: ["string", "null"] },
    color: { type: ["string", "null"], enum: ["red", "white", "skin-contact", null] },
    is_sparkling: { type: ["boolean", "null"] },
    ai_summary: { type: ["string", "null"], maxLength: 300 },
    ai_overview: { type: ["string", "null"], maxLength: 300 },
    ai_geography: { type: ["string", "null"], maxLength: 300 },
    ai_production: { type: ["string", "null"], maxLength: 300 },
    ai_tasting_notes: { type: ["string", "null"], maxLength: 300 },
    ai_pairings: { type: ["string", "null"], maxLength: 300 },
    drink_from: { type: ["integer", "null"] },
    drink_until: { type: ["integer", "null"] },
  },
  required: ["producer", "varietal", "vintage", "region", "color", "is_sparkling", "ai_overview", "ai_geography", "ai_production", "ai_tasting_notes", "ai_pairings", "drink_from", "drink_until"],
  additionalProperties: false,
};

interface ReqBody {
  image?: string; // data:image/...;base64,... or base64 only
  image_url?: string; // public HTTPS URL
}

interface WineExtraction {
  producer: string | null;
  varietal: string | null;
  vintage: number | null;
  region: string | null;
  ai_summary: string | null;
  color: "red" | "white" | "skin-contact" | null;
  is_sparkling: boolean | null;
  ai_overview: string | null;
  ai_geography: string | null;
  ai_production: string | null;
  ai_tasting_notes: string | null;
  ai_pairings: string | null;
  drink_from: number | null;
  drink_until: number | null;
  label_photo_url: string | null;
}

const AI_MAX_CHARS = 300;

/** Strip Perplexity citation refs like [1][2], collapse extra whitespace, and truncate to the last
 *  complete sentence within AI_MAX_CHARS. Falls back to a hard cut + ellipsis if no sentence boundary found. */
function cleanAiText(text: string): string {
  let s = text.replace(/\[\d+\]/g, "").replace(/\s{2,}/g, " ").trim();
  if (s.length <= AI_MAX_CHARS) return s;
  const truncated = s.slice(0, AI_MAX_CHARS);
  const lastPeriod = truncated.lastIndexOf(".");
  return lastPeriod > 0 ? truncated.slice(0, lastPeriod + 1).trim() : truncated.trim() + "…";
}

function normalizeWineExtraction(obj: unknown): Omit<WineExtraction, "label_photo_url"> {
  const o = obj && typeof obj === "object" ? obj as Record<string, unknown> : {};
  const color = typeof o.color === "string" && ["red", "white", "skin-contact"].includes(o.color) 
    ? o.color as "red" | "white" | "skin-contact" 
    : null;
  return {
    producer: typeof o.producer === "string" ? o.producer : null,
    varietal: typeof o.varietal === "string" ? o.varietal : null,
    vintage: typeof o.vintage === "number" && Number.isInteger(o.vintage) ? o.vintage : null,
    region: typeof o.region === "string" ? o.region : null,
    ai_summary: typeof o.ai_summary === "string" ? cleanAiText(o.ai_summary) : null,
    color,
    is_sparkling: typeof o.is_sparkling === "boolean" ? o.is_sparkling : null,
    ai_overview: typeof o.ai_overview === "string" ? cleanAiText(o.ai_overview) : null,
    ai_geography: typeof o.ai_geography === "string" ? cleanAiText(o.ai_geography) : null,
    ai_production: typeof o.ai_production === "string" ? cleanAiText(o.ai_production) : null,
    ai_tasting_notes: typeof o.ai_tasting_notes === "string" ? cleanAiText(o.ai_tasting_notes) : null,
    ai_pairings: typeof o.ai_pairings === "string" ? cleanAiText(o.ai_pairings) : null,
    drink_from: typeof o.drink_from === "number" && Number.isInteger(o.drink_from) ? o.drink_from : null,
    drink_until: typeof o.drink_until === "number" && Number.isInteger(o.drink_until) ? o.drink_until : null,
  };
}

const LABEL_PHOTOS_BUCKET = "label-photos";

/** Decode base64 (optionally data URI) to Uint8Array. */
function decodeBase64Image(image: string): Uint8Array | null {
  const base64 = image.includes(",") ? image.split(",")[1]?.trim() : image;
  if (!base64) return null;
  try {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  } catch {
    return null;
  }
}

/** Upload image bytes to label-photos bucket; return public URL or null on failure. */
async function uploadLabelPhoto(imageBytes: Uint8Array): Promise<string | null> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    console.warn("extract-wine-label: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set, skipping upload");
    return null;
  }
  const supabase = createClient(supabaseUrl, serviceRoleKey) as SupabaseStorageClient;
  const path = `${crypto.randomUUID()}.jpg`;
  const { data, error } = await supabase.storage
    .from(LABEL_PHOTOS_BUCKET)
    .upload(path, imageBytes, { contentType: "image/jpeg", upsert: false });
  if (error) {
    console.error("extract-wine-label: storage upload failed", error.message);
    return null;
  }
  const { data: urlData } = supabase.storage.from(LABEL_PHOTOS_BUCKET).getPublicUrl(data.path);
  return urlData.publicUrl;
}

function buildContent(body: ReqBody): { type: string; text?: string; image_url?: { url: string } }[] {
  const parts: { type: string; text?: string; image_url?: { url: string } }[] = [
    { type: "text", text: EXTRACTION_PROMPT },
  ];
  if (body.image_url) {
    parts.push({ type: "image_url", image_url: { url: body.image_url } });
  } else if (body.image) {
    const url = body.image.startsWith("data:") ? body.image : `data:image/jpeg;base64,${body.image}`;
    parts.push({ type: "image_url", image_url: { url } });
  }
  return parts;
}

async function verifyAuth(req: Request): Promise<Response | null> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return jsonResponse({ error: "Missing or invalid Authorization header" }, 401);
  }
  const token = authHeader.slice(7).trim();
  if (!token) return jsonResponse({ error: "Invalid JWT" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  if (!supabaseUrl) {
    console.error("extract-wine-label: SUPABASE_URL not set");
    return jsonResponse({ error: "Server configuration error" }, 500);
  }
  const issuer = Deno.env.get("SB_JWT_ISSUER") ?? `${supabaseUrl}/auth/v1`;
  const jwksUrl = new URL(`${supabaseUrl}/auth/v1/.well-known/jwks.json`);
  try {
    const JWKS = jose.createRemoteJWKSet(jwksUrl);
    await jose.jwtVerify(token, JWKS, { issuer });
    return null;
  } catch (e) {
    console.warn("extract-wine-label: JWT verification failed", e);
    return jsonResponse({ error: "Invalid JWT" }, 401);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders() });
  }

  const authError = await verifyAuth(req);
  if (authError) return authError;

  const apiKey = Deno.env.get("PERPLEXITY_API_KEY");
  console.log("extract-wine-label: request received, PERPLEXITY_API_KEY:", apiKey ? "present" : "missing");
  if (!apiKey) {
    return jsonResponse({ error: "PERPLEXITY_API_KEY not configured" }, 500);
  }

  let body: ReqBody;
  try {
    body = (await req.json()) as ReqBody;
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  if (!body.image && !body.image_url) {
    return jsonResponse({ error: "Provide 'image' (base64 or data URI) or 'image_url' (HTTPS)" }, 400);
  }

  const content = buildContent(body);
  if (content.length < 2) {
    return jsonResponse({ error: "Missing image payload" }, 400);
  }

  try {
    const res = await fetch(PERPLEXITY_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: "user", content: content }],
        max_tokens: 1024,
        temperature: 0.1,
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "wine_extraction",
            schema: jsonSchema,
          },
        },
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("extract-wine-label: Perplexity API error", res.status, errText.slice(0, 300));
      return jsonResponse(
        { error: "Label extraction failed", details: res.status === 401 ? "Invalid API key" : errText.slice(0, 200) },
        res.status >= 500 ? 502 : 400
      );
    }

    console.log("extract-wine-label: Perplexity OK");
    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const raw = data?.choices?.[0]?.message?.content;
    if (!raw) {
      console.error("extract-wine-label: empty content from Perplexity");
      return jsonResponse({ error: "Empty response from AI" }, 502);
    }

    const rawTrimmed = raw.trim();
    const jsonStr = rawTrimmed.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      console.error("extract-wine-label: invalid JSON from model", rawTrimmed.slice(0, 200));
      return jsonResponse({ error: "Invalid extraction response" }, 502);
    }

    const extracted = normalizeWineExtraction(parsed);
    let label_photo_url: string | null = null;
    if (body.image) {
      const imageBytes = decodeBase64Image(body.image);
      if (imageBytes && imageBytes.length > 10 * 1024 * 1024) {
        return jsonResponse({ error: "Image too large (max 10 MB)" }, 413);
      }
      if (imageBytes) label_photo_url = await uploadLabelPhoto(imageBytes);
    }
    const response: WineExtraction = { ...extracted, label_photo_url };
    return jsonResponse(response);
  } catch (e) {
    console.error("extract-wine-label error", e);
    return jsonResponse({ error: e instanceof Error ? e.message : "Extraction failed" }, 500);
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

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders() },
  });
}
