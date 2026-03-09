// Supabase Edge Function: fetch-partiful-event
// Fetches a public Partiful event page server-side and extracts title, date, and description
// so the client can pre-fill the Phína create-event form without manual data entry.
//
// Auth: Verifies JWT via project JWKS (same pattern as extract-wine-label).
// SSRF: Only fetches partiful.com URLs. Query params (tracking tokens) are stripped.

import * as jose from "npm:jose";

interface PartifulEventData {
  title: string;
  date: string | null; // YYYY-MM-DD
  description: string | null;
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders() },
  });
}

async function verifyAuth(req: Request): Promise<Response | null> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return jsonResponse({ error: "Missing or invalid Authorization header" }, 401);
  }
  const token = authHeader.slice(7).trim();
  if (!token) return jsonResponse({ error: "Invalid JWT" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  if (!supabaseUrl) {
    console.error("fetch-partiful-event: SUPABASE_URL not set");
    return jsonResponse({ error: "Server configuration error" }, 500);
  }
  const issuer = Deno.env.get("SB_JWT_ISSUER") ?? `${supabaseUrl}/auth/v1`;
  const jwksUrl = new URL(`${supabaseUrl}/auth/v1/.well-known/jwks.json`);
  try {
    const JWKS = jose.createRemoteJWKSet(jwksUrl);
    await jose.jwtVerify(token, JWKS, { issuer });
    return null;
  } catch (e) {
    console.warn("fetch-partiful-event: JWT verification failed", e);
    return jsonResponse({ error: "Invalid JWT" }, 401);
  }
}

/** Extract the value of an og: or twitter: meta tag from raw HTML. */
function extractMeta(html: string, property: string): string | null {
  // Handle both attribute orderings: property="..." content="..." and content="..." property="..."
  const patterns = [
    new RegExp(`<meta[^>]+property=["']${property}["'][^>]+content=["']([^"']+)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${property}["']`, "i"),
    new RegExp(`<meta[^>]+name=["']${property}["'][^>]+content=["']([^"']+)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${property}["']`, "i"),
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m?.[1]) return decodeHtmlEntities(m[1]);
  }
  return null;
}

/** Decode common HTML entities in attribute values. */
function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
}

/** Convert an ISO 8601 datetime string to YYYY-MM-DD. */
function isoToDate(iso: string): string | null {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

/** Parse a human-readable date string like "March 14, 2026" or "Saturday, March 14, 2026 at 6:00 PM". */
function parseDisplayDate(text: string): string | null {
  const MONTHS = ["january","february","march","april","may","june","july","august","september","october","november","december"];
  const m = text.match(/\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),\s+(\d{4})\b/i);
  if (!m) return null;
  const [, monthName, day, year] = m;
  const monthIdx = MONTHS.indexOf(monthName.toLowerCase());
  if (monthIdx === -1) return null;
  const mm = String(monthIdx + 1).padStart(2, "0");
  const dd = String(parseInt(day, 10)).padStart(2, "0");
  return `${year}-${mm}-${dd}`;
}

function parsePartifulHtml(html: string): PartifulEventData {
  // 1. Try JSON-LD structured data — most reliable if present
  const ldMatches = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  for (const ldMatch of ldMatches) {
    try {
      const ld = JSON.parse(ldMatch[1]);
      const candidates = Array.isArray(ld) ? ld : [ld];
      for (const node of candidates) {
        if (node?.["@type"] === "Event" && typeof node.name === "string") {
          const title = node.name as string;
          const date = typeof node.startDate === "string" ? isoToDate(node.startDate) : null;
          const description = typeof node.description === "string" ? node.description : null;
          return { title, date, description };
        }
      }
    } catch {
      // malformed JSON-LD — keep trying
    }
  }

  // 2. Fall back to Open Graph / Twitter Card meta tags
  const title =
    extractMeta(html, "og:title") ??
    extractMeta(html, "twitter:title") ??
    extractPageTitle(html);

  const description =
    extractMeta(html, "og:description") ??
    extractMeta(html, "twitter:description") ??
    null;

  // 3. Try to find a date string anywhere in the description or page body
  let date: string | null = null;
  if (description) date = parseDisplayDate(description);
  if (!date) {
    // Search the raw HTML for a recognizable date pattern
    const bodyText = html.replace(/<[^>]+>/g, " ");
    date = parseDisplayDate(bodyText);
  }

  return {
    title: title ?? "Wine Tasting",
    date,
    description,
  };
}

/** Extract text from the <title> tag as a last resort. */
function extractPageTitle(html: string): string | null {
  const m = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return m?.[1] ? decodeHtmlEntities(m[1].trim()) : null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders() });
  }

  const authError = await verifyAuth(req);
  if (authError) return authError;

  let rawUrl: string;
  try {
    const body = (await req.json()) as { url?: unknown };
    if (typeof body.url !== "string" || !body.url.trim()) {
      return jsonResponse({ error: "url is required" }, 400);
    }
    rawUrl = body.url.trim();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  // Validate this is a Partiful URL — strict SSRF prevention
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return jsonResponse({ error: "Invalid URL" }, 400);
  }
  if (parsed.hostname !== "partiful.com" && !parsed.hostname.endsWith(".partiful.com")) {
    return jsonResponse({ error: "Only partiful.com URLs are supported" }, 400);
  }
  // Strip query params (tracking/referral tokens like ?c=...)
  const cleanUrl = `${parsed.origin}${parsed.pathname}`;

  console.log("fetch-partiful-event: fetching", cleanUrl);

  let html: string;
  try {
    const res = await fetch(cleanUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; Phina/1.0; +https://phina.app)",
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
      },
      redirect: "follow",
    });
    if (!res.ok) {
      return jsonResponse({ error: `Could not fetch Partiful event (HTTP ${res.status})` }, 422);
    }
    html = await res.text();
  } catch (e) {
    console.error("fetch-partiful-event: network error", e);
    return jsonResponse({ error: "Could not reach Partiful — check your URL and try again" }, 502);
  }

  const result = parsePartifulHtml(html);
  console.log("fetch-partiful-event: parsed", JSON.stringify(result));
  return jsonResponse(result);
});
