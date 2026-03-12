// Supabase Edge Function: send push notifications when a rating round starts.
// Invoked by the host's client after inserting into rating_rounds.
// Body: { event_id: string, wine_id: string }
// Sends to event members (checked in) who have a push_token:
// - If push_token is JSON with "endpoint" -> Web Push (VAPID).
// - If push_token starts with "ExponentPushToken[" -> Expo Push.

import { createClient } from "npm:@supabase/supabase-js@2";
import { buildPushHTTPRequest } from "npm:@pushforge/builder@2";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const SUPABASE_URL = mustGetEnv("SUPABASE_URL");
const SUPABASE_ANON_KEY = mustGetEnv("SUPABASE_ANON_KEY");
const SUPABASE_SERVICE_ROLE_KEY = mustGetEnv("SUPABASE_SERVICE_ROLE_KEY");

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

interface EventRow {
  id: string;
  created_by: string;
}

interface CallerMemberRow {
  id: string;
  is_admin: boolean | null;
}

interface WineRow {
  id: string;
  event_id: string;
  producer: string | null;
  varietal: string | null;
  vintage: number | null;
}

interface PushSendResult {
  sent: number;
  expo_recipients: number;
  web_recipients: number;
  expo_sent: number;
  web_sent: number;
  skipped_reason: string | null;
}

function mustGetEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) {
    throw new Error(`${name} is not configured`);
  }
  return value;
}

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

function errorResponse(error: string, errorCode: string, status: number, extra: Record<string, unknown> = {}): Response {
  return jsonResponse({ error, error_code: errorCode, ...extra }, status);
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
  if (!authHeader?.startsWith("Bearer ")) {
    return errorResponse("Missing or invalid Authorization header", "unauthorized", 401);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- SupabaseClient from npm: is typed in Deno at runtime
  const authedSupabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  }) as any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- SupabaseClient from npm: is typed in Deno at runtime
  const adminSupabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY) as any;

  const { data: userData, error: userError } = await authedSupabase.auth.getUser();
  if (userError || !userData.user) {
    return errorResponse("Unauthorized", "unauthorized", 401);
  }

  let body: ReqBody;
  try {
    body = (await req.json()) as ReqBody;
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  const eventId = body.event_id;
  const wineId = body.wine_id;
  if (!eventId || !wineId) {
    return errorResponse("Provide event_id and wine_id", "invalid_request", 400);
  }

  try {
    const { data: event, error: eventError } = await adminSupabase
      .from("events")
      .select("id, created_by")
      .eq("id", eventId)
      .maybeSingle();

    if (eventError) {
      console.error("events query error", eventError);
      return errorResponse("Failed to load event", "internal_error", 500);
    }

    if (!event) {
      return errorResponse("Event not found", "event_not_found", 404);
    }

    const isHost = (event as EventRow).created_by === userData.user.id;
    let isAdmin = false;

    if (!isHost) {
      const { data: callerMember, error: callerMemberError } = await adminSupabase
        .from("members")
        .select("id, is_admin")
        .eq("id", userData.user.id)
        .maybeSingle();

      if (callerMemberError) {
        console.error("caller member query error", callerMemberError);
        return errorResponse("Failed to authorize caller", "internal_error", 500);
      }

      isAdmin = (callerMember as CallerMemberRow | null)?.is_admin === true;
    }

    if (!isHost && !isAdmin) {
      return errorResponse("Forbidden", "forbidden", 403);
    }

    const { data: wine, error: wineError } = await adminSupabase
      .from("wines")
      .select("id, event_id, producer, varietal, vintage")
      .eq("id", wineId)
      .eq("event_id", eventId)
      .maybeSingle();

    if (wineError || !wine) {
      return errorResponse("Wine not found", "wine_not_found", 404);
    }

    const typedWine = wine as WineRow;
    const wineLabel = [typedWine.producer, typedWine.varietal, typedWine.vintage].filter(Boolean).join(" ") || "This wine";
    const path = `/event/${eventId}/rate/${wineId}`;

    const { data: eventMembers, error: emError } = await adminSupabase
      .from("event_members")
      .select("member_id")
      .eq("event_id", eventId)
      .eq("checked_in", true);

    if (emError) {
      console.error("event_members query error", emError);
      return errorResponse("Failed to load event members", "internal_error", 500);
    }

    const memberIds = (eventMembers ?? []).map((r: EventMemberRow) => r.member_id);
    if (memberIds.length === 0) {
      return jsonResponse({
        sent: 0,
        expo_recipients: 0,
        web_recipients: 0,
        expo_sent: 0,
        web_sent: 0,
        skipped_reason: "no_checked_in_members",
      } satisfies PushSendResult);
    }

    const { data: members, error: membersError } = await adminSupabase
      .from("members")
      .select("id, push_token")
      .in("id", memberIds)
      .not("push_token", "is", null);

    if (membersError) {
      console.error("members query error", membersError);
      return errorResponse("Failed to load members", "internal_error", 500);
    }

    const tokens = (members ?? []).map((m: MemberRow) => m.push_token).filter((t: string | null): t is string => typeof t === "string" && t.length > 0);
    const webPushSubs: WebPushSubscription[] = [];
    const expoTokens: string[] = [];
    for (const t of tokens) {
      const sub = isWebPushSubscription(t);
      if (sub) webPushSubs.push(sub);
      else if (isExpoToken(t)) expoTokens.push(t);
    }

    const result: PushSendResult = {
      sent: 0,
      expo_recipients: expoTokens.length,
      web_recipients: webPushSubs.length,
      expo_sent: 0,
      web_sent: 0,
      skipped_reason: null,
    };

    if (result.expo_recipients === 0 && result.web_recipients === 0) {
      result.skipped_reason = "no_push_tokens";
      return jsonResponse(result);
    }

    let providerFailures = 0;

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
            if (res.status === 201 || res.status === 200) {
              result.web_sent += 1;
            } else {
              providerFailures += 1;
              console.warn("Web Push failed", res.status, await res.text());
            }
          } catch (e) {
            providerFailures += 1;
            console.warn("Web Push error for subscription", e);
          }
        }
      }
    } else if (webPushSubs.length > 0) {
      providerFailures += webPushSubs.length;
      console.error("VAPID_PRIVATE_KEY is not configured; cannot send Web Push notifications.");
    }

    // Expo Push
    if (expoTokens.length > 0) {
      const messages = expoTokens.map((to) => ({
        to,
        sound: "default" as const,
        interruptionLevel: "time-sensitive" as const,
        title: "Rate this wine",
        body: wineLabel,
        data: { url: path },
      }));
      const pushRes = await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: { "Accept": "application/json", "Content-Type": "application/json" },
        body: JSON.stringify(messages),
      });
      if (pushRes.ok) {
        result.expo_sent += messages.length;
      } else {
        providerFailures += messages.length;
        const errText = await pushRes.text();
        console.error("Expo push error", pushRes.status, errText);
      }
    }

    result.sent = result.expo_sent + result.web_sent;

    if (result.sent === 0 && providerFailures > 0) {
      return errorResponse("Push provider error", "push_provider_error", 500, result);
    }

    return jsonResponse(result);
  } catch (e) {
    console.error("send-rating-round-push error", e);
    return errorResponse(e instanceof Error ? e.message : "Internal error", "internal_error", 500);
  }
});
