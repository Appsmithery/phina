// Supabase Edge Function: generate-wine-summary
// Generates AI fields (geography, production, tasting notes, pairings, drink window,
// wine_attributes) for wines added manually WITHOUT a label scan.
// Uses Perplexity Sonar Pro in text-only mode — same AI provider as extract-wine-label.

import * as jose from "npm:jose";

const PERPLEXITY_URL = "https://api.perplexity.ai/chat/completions";
const MODEL = "sonar-pro";
const AI_MAX_CHARS = 300;

const ENRICHMENT_PROMPT = `You are a friendly wine guide writing for people who are new to wine.

Based on the wine details provided below, generate educational content about this wine.

Tone rules:
- Warm, conversational language as if recommending a wine to a curious friend.
- Briefly explain wine jargon in plain language.
- Every text field must be exactly 1-2 short sentences, maximum 40 words.
- Do NOT include citation references like [1], [2], etc.

Return a JSON object with exactly these keys (use null for missing/unclear values):
- ai_geography: string (1-2 sentences: where it's from and what makes that place great for this style.)
- ai_production: string (1-2 sentences: how it's made in plain language.)
- ai_tasting_notes: string (1-2 sentences: what it tastes and smells like, using everyday words.)
- ai_pairings: string (1-2 sentences: specific food pairings a friend might suggest.)
- drink_from: number or null (year this wine should start being at its best. Use current year if ready now.)
- drink_until: number or null (year by which this wine should ideally be consumed.)
- wine_attributes: object with these keys (use null when uncertain):
    - oak: "oaked", "unoaked", or "stainless"
    - oak_intensity: "new", "neutral", or null
    - climate: "cool", "moderate", or "warm"
    - body_inferred: "light", "medium", or "full"
    - tannin_inferred: "low", "medium", or "high" (null for whites/sparkling)
    - acidity_inferred: "low", "medium", or "high"
    - style: "conventional", "natural", "biodynamic", or "organic" (null if unknown)`;

const jsonSchema = {
  type: "object",
  properties: {
    ai_geography: { type: ["string", "null"], maxLength: 300 },
    ai_production: { type: ["string", "null"], maxLength: 300 },
    ai_tasting_notes: { type: ["string", "null"], maxLength: 300 },
    ai_pairings: { type: ["string", "null"], maxLength: 300 },
    drink_from: { type: ["integer", "null"] },
    drink_until: { type: ["integer", "null"] },
    wine_attributes: {
      type: ["object", "null"],
      properties: {
        oak: { type: ["string", "null"], enum: ["oaked", "unoaked", "stainless", null] },
        oak_intensity: { type: ["string", "null"], enum: ["new", "neutral", null] },
        climate: { type: ["string", "null"], enum: ["cool", "moderate", "warm", null] },
        body_inferred: { type: ["string", "null"], enum: ["light", "medium", "full", null] },
        tannin_inferred: { type: ["string", "null"], enum: ["low", "medium", "high", null] },
        acidity_inferred: { type: ["string", "null"], enum: ["low", "medium", "high", null] },
        style: { type: ["string", "null"], enum: ["conventional", "natural", "biodynamic", "organic", null] },
      },
      additionalProperties: false,
    },
  },
  required: ["ai_geography", "ai_production", "ai_tasting_notes", "ai_pairings", "drink_from", "drink_until", "wine_attributes"],
  additionalProperties: false,
};

interface ReqBody {
  producer?: string | null;
  varietal?: string | null;
  vintage?: number | null;
  region?: string | null;
  color?: "red" | "white" | "skin-contact" | null;
  is_sparkling?: boolean | null;
}

interface WineAttributes {
  oak: "oaked" | "unoaked" | "stainless" | null;
  oak_intensity: "new" | "neutral" | null;
  climate: "cool" | "moderate" | "warm" | null;
  body_inferred: "light" | "medium" | "full" | null;
  tannin_inferred: "low" | "medium" | "high" | null;
  acidity_inferred: "low" | "medium" | "high" | null;
  style: "conventional" | "natural" | "biodynamic" | "organic" | null;
}

interface WineSummary {
  ai_geography: string | null;
  ai_production: string | null;
  ai_tasting_notes: string | null;
  ai_pairings: string | null;
  drink_from: number | null;
  drink_until: number | null;
  wine_attributes: WineAttributes | null;
}

function cleanAiText(text: string): string {
  let s = text.replace(/\[\d+\]/g, "").replace(/\s{2,}/g, " ").trim();
  if (s.length <= AI_MAX_CHARS) return s;
  const truncated = s.slice(0, AI_MAX_CHARS);
  const lastPeriod = truncated.lastIndexOf(".");
  return lastPeriod > 0 ? truncated.slice(0, lastPeriod + 1).trim() : truncated.trim() + "…";
}

function normalizeWineAttributes(raw: unknown): WineAttributes | null {
  if (!raw || typeof raw !== "object") return null;
  const a = raw as Record<string, unknown>;
  const pick = <T extends string>(val: unknown, allowed: T[]): T | null =>
    typeof val === "string" && (allowed as string[]).includes(val) ? val as T : null;
  return {
    oak: pick(a.oak, ["oaked", "unoaked", "stainless"]),
    oak_intensity: pick(a.oak_intensity, ["new", "neutral"]),
    climate: pick(a.climate, ["cool", "moderate", "warm"]),
    body_inferred: pick(a.body_inferred, ["light", "medium", "full"]),
    tannin_inferred: pick(a.tannin_inferred, ["low", "medium", "high"]),
    acidity_inferred: pick(a.acidity_inferred, ["low", "medium", "high"]),
    style: pick(a.style, ["conventional", "natural", "biodynamic", "organic"]),
  };
}

function normalizeWineSummary(obj: unknown): WineSummary {
  const o = obj && typeof obj === "object" ? obj as Record<string, unknown> : {};
  return {
    ai_geography: typeof o.ai_geography === "string" ? cleanAiText(o.ai_geography) : null,
    ai_production: typeof o.ai_production === "string" ? cleanAiText(o.ai_production) : null,
    ai_tasting_notes: typeof o.ai_tasting_notes === "string" ? cleanAiText(o.ai_tasting_notes) : null,
    ai_pairings: typeof o.ai_pairings === "string" ? cleanAiText(o.ai_pairings) : null,
    drink_from: typeof o.drink_from === "number" && Number.isInteger(o.drink_from) ? o.drink_from : null,
    drink_until: typeof o.drink_until === "number" && Number.isInteger(o.drink_until) ? o.drink_until : null,
    wine_attributes: normalizeWineAttributes(o.wine_attributes),
  };
}

function buildWineDescription(body: ReqBody): string {
  const colorDesc =
    body.color === "red" ? "Red wine" :
    body.color === "white" ? "White wine" :
    body.color === "skin-contact" ? "Rosé/Orange wine" : "Wine";
  const sparklingDesc = body.is_sparkling ? " (sparkling)" : "";
  const details = [
    body.producer ? `Producer: ${body.producer}` : null,
    body.varietal ? `Varietal: ${body.varietal}` : null,
    body.vintage ? `Vintage: ${body.vintage}` : null,
    body.region ? `Region: ${body.region}` : null,
  ].filter(Boolean).join(", ");
  return `${colorDesc}${sparklingDesc}. ${details}`;
}

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
    console.warn("generate-wine-summary: JWT verification failed", e);
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
  if (!apiKey) {
    return jsonResponse({ error: "PERPLEXITY_API_KEY not configured" }, 500);
  }

  let body: ReqBody;
  try {
    body = (await req.json()) as ReqBody;
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  if (!body.producer && !body.varietal && !body.region) {
    return jsonResponse({ error: "Provide at least one of: producer, varietal, region" }, 400);
  }

  const wineDescription = buildWineDescription(body);
  const userMessage = `${ENRICHMENT_PROMPT}\n\nWine details: ${wineDescription}`;

  try {
    const res = await fetch(PERPLEXITY_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: "user", content: userMessage }],
        max_tokens: 1024,
        temperature: 0.1,
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "wine_summary",
            schema: jsonSchema,
          },
        },
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("generate-wine-summary: Perplexity error", res.status, errText.slice(0, 200));
      return jsonResponse(
        { error: "AI enrichment failed", details: errText.slice(0, 200) },
        res.status >= 500 ? 502 : 400
      );
    }

    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const raw = data?.choices?.[0]?.message?.content;
    if (!raw) {
      return jsonResponse({ error: "Empty response from AI" }, 502);
    }

    const jsonStr = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      console.error("generate-wine-summary: invalid JSON from model", raw.slice(0, 200));
      return jsonResponse({ error: "Invalid AI response" }, 502);
    }

    return jsonResponse(normalizeWineSummary(parsed));
  } catch (e) {
    console.error("generate-wine-summary error", e);
    return jsonResponse({ error: e instanceof Error ? e.message : "Enrichment failed" }, 500);
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
