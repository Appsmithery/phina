// Supabase Edge Function: extract wine label data using Perplexity Sonar (vision + structured output)
// Sonar provides: (1) OCR / vision over the label image, (2) web-grounded search for tasting notes and basic wine info in ai_summary.
// See https://docs.perplexity.ai/docs/sonar/quickstart and https://docs.perplexity.ai/docs/sonar/media

const PERPLEXITY_URL = "https://api.perplexity.ai/chat/completions";
const MODEL = "sonar-pro";

const EXTRACTION_PROMPT = `You are analyzing a photo of a wine bottle label. Extract the following from the label text and any recognizable design or branding. Use your knowledge (and search if helpful) to add a short summary. If something is not visible or unclear, omit it or use null.

Return a JSON object with exactly these keys (use null for missing values):
- producer: string (winery or producer name)
- varietal: string (e.g. Pinot Noir, Chardonnay)
- vintage: number or null (year)
- region: string (e.g. Burgundy, Napa Valley)
- ai_summary: string (2-3 sentences about this wine's region, typical flavor profile, and any notable facts a dinner guest would find interesting; use search/knowledge to enrich if needed; if you cannot infer, use a brief generic note or null)`;

const jsonSchema = {
  type: "object",
  properties: {
    producer: { type: ["string", "null"] },
    varietal: { type: ["string", "null"] },
    vintage: { type: ["integer", "null"] },
    region: { type: ["string", "null"] },
    ai_summary: { type: ["string", "null"] },
  },
  required: ["producer", "varietal", "vintage", "region", "ai_summary"],
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
}

function normalizeWineExtraction(obj: unknown): WineExtraction {
  const o = obj && typeof obj === "object" ? obj as Record<string, unknown> : {};
  return {
    producer: typeof o.producer === "string" ? o.producer : null,
    varietal: typeof o.varietal === "string" ? o.varietal : null,
    vintage: typeof o.vintage === "number" && Number.isInteger(o.vintage) ? o.vintage : null,
    region: typeof o.region === "string" ? o.region : null,
    ai_summary: typeof o.ai_summary === "string" ? o.ai_summary : null,
  };
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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders() });
  }

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
      console.error("Perplexity API error", res.status, errText);
      return jsonResponse(
        { error: "Label extraction failed", details: res.status === 401 ? "Invalid API key" : errText.slice(0, 200) },
        res.status >= 500 ? 502 : 400
      );
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const raw = data?.choices?.[0]?.message?.content;
    if (!raw) {
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
    return jsonResponse(extracted);
  } catch (e) {
    console.error("extract-wine-label error", e);
    return jsonResponse({ error: e instanceof Error ? e.message : "Extraction failed" }, 500);
  }
});

function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
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
