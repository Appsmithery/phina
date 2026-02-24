// Supabase Edge Function: send push notifications when a rating round starts.
// Invoked by the host's client after inserting into rating_rounds.
// Body: { event_id: string, wine_id: string }
// Sends to event members (checked in) who have a push_token:
// - If push_token is JSON with "endpoint" -> Web Push (VAPID).
// - If push_token starts with "ExponentPushToken[" -> Expo Push.

import { createClient } from "npm:@supabase/supabase-js@2";
import { buildPushHTTPRequest } from "npm:@pushforge/builder@2";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

interface ReqBody {
  event_id?: string;
  wine_id?: string;
}

interface WebPushSubscription {
  endpoint: string;
  keys?: { p256dh?: string; auth?: string };
  expirationTime?: number | null;
}

interface EventMemberRow {
  member_id: string;
}

interface MemberRow {
  id: string;
  push_token: string | null;
}

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

function isWebPushSubscription(token: string): WebPushSubscription | null {
  try {
    const parsed = JSON.parse(token) as unknown;
    if (parsed && typeof parsed === "object" && "endpoint" in parsed && typeof (parsed as WebPushSubscription).endpoint === "string") {
      return parsed as WebPushSubscription;
    }
  } catch {
    // not JSON
  }
  return null;
}

function isExpoToken(token: string): boolean {
  return typeof token === "string" && token.startsWith("ExponentPushToken[");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders() });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return jsonResponse({ error: "Missing Authorization header" }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- SupabaseClient from npm: is typed in Deno at runtime
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  }) as any;

  let body: ReqBody;
  try {
    body = (await req.json()) as ReqBody;
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  const eventId = body.event_id;
  const wineId = body.wine_id;
  if (!eventId || !wineId) {
    return jsonResponse({ error: "Provide event_id and wine_id" }, 400);
  }

  try {
    const { data: wine, error: wineError } = await supabase
      .from("wines")
      .select("producer, varietal, vintage")
      .eq("id", wineId)
      .single();

    if (wineError || !wine) {
      return jsonResponse({ error: "Wine not found" }, 404);
    }

    const wineLabel = [wine.producer, wine.varietal, wine.vintage].filter(Boolean).join(" ") || "This wine";
    const path = `/event/${eventId}/rate/${wineId}`;

    const { data: eventMembers, error: emError } = await supabase
      .from("event_members")
      .select("member_id")
      .eq("event_id", eventId)
      .eq("checked_in", true);

    if (emError) {
      console.error("event_members query error", emError);
      return jsonResponse({ error: "Failed to load event members" }, 500);
    }

    const memberIds = (eventMembers ?? []).map((r: EventMemberRow) => r.member_id);
    if (memberIds.length === 0) {
      return jsonResponse({ sent: 0, message: "No checked-in members" });
    }

    const { data: members, error: membersError } = await supabase
      .from("members")
      .select("id, push_token")
      .in("id", memberIds)
      .not("push_token", "is", null);

    if (membersError) {
      console.error("members query error", membersError);
      return jsonResponse({ error: "Failed to load members" }, 500);
    }

    const tokens = (members ?? []).map((m: MemberRow) => m.push_token).filter((t: string | null): t is string => typeof t === "string" && t.length > 0);
    const webPushSubs: WebPushSubscription[] = [];
    const expoTokens: string[] = [];
    for (const t of tokens) {
      const sub = isWebPushSubscription(t);
      if (sub) webPushSubs.push(sub);
      else if (isExpoToken(t)) expoTokens.push(t);
    }

    let sent = 0;

    // Web Push (VAPID)
    const vapidPrivateKeyJson = Deno.env.get("VAPID_PRIVATE_KEY");
    if (webPushSubs.length > 0 && vapidPrivateKeyJson) {
      let privateJWK: { kty: string; crv: string; x?: string; y?: string; d: string } | null = null;
      try {
        privateJWK = JSON.parse(vapidPrivateKeyJson) as typeof privateJWK;
      } catch {
        console.error("VAPID_PRIVATE_KEY is not valid JSON (expected JWK from npx @pushforge/builder vapid)");
      }
      if (privateJWK) {
        const adminContact = "mailto:support@phina.appsmithery.co";
        for (const subscription of webPushSubs) {
          const keys = subscription.keys ?? {};
          const subForPush = {
            endpoint: subscription.endpoint,
            keys: {
              p256dh: keys.p256dh ?? "",
              auth: keys.auth ?? "",
            },
          };
          try {
            const { endpoint, headers, body: pushBody } = await buildPushHTTPRequest({
              privateJWK,
              subscription: subForPush,
              message: {
                payload: { title: "Rate this wine", body: wineLabel, data: { url: path } },
                adminContact,
              },
            });
            const res = await fetch(endpoint, { method: "POST", headers, body: pushBody });
            if (res.status === 201 || res.status === 200) sent++;
            else console.warn("Web Push failed", res.status, await res.text());
          } catch (e) {
            console.warn("Web Push error for subscription", e);
          }
        }
      }
    }

    // Expo Push
    if (expoTokens.length > 0) {
      const messages = expoTokens.map((to) => ({
        to,
        sound: "default" as const,
        title: "Rate this wine",
        body: wineLabel,
        data: { url: path },
      }));
      const pushRes = await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: { "Accept": "application/json", "Content-Type": "application/json" },
        body: JSON.stringify(messages),
      });
      if (pushRes.ok) sent += messages.length;
      else {
        const errText = await pushRes.text();
        console.error("Expo push error", pushRes.status, errText);
      }
    }

    return jsonResponse({ sent });
  } catch (e) {
    console.error("send-rating-round-push error", e);
    return jsonResponse({ error: e instanceof Error ? e.message : "Internal error" }, 500);
  }
});
