import { createClient } from "npm:@supabase/supabase-js@2.99.0";

const APP_URL = Deno.env.get("APP_URL") ?? "https://phina.appsmithery.co";
const SUPABASE_URL = mustGetEnv("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = mustGetEnv("SUPABASE_SERVICE_ROLE_KEY");
const REVENUECAT_WEBHOOK_AUTH = Deno.env.get("REVENUECAT_WEBHOOK_AUTH") ?? "";
const REVENUECAT_PREMIUM_ENTITLEMENT_ID = Deno.env.get("REVENUECAT_PREMIUM_ENTITLEMENT_ID") ?? "premium";
const REVENUECAT_HOST_CREDIT_PRODUCT_ID = mustGetEnv("REVENUECAT_HOST_CREDIT_PRODUCT_ID");

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

interface RevenueCatEventEnvelope {
  event?: RevenueCatEvent;
}

interface RevenueCatEvent {
  id?: string;
  type?: string;
  app_user_id?: string | null;
  original_app_user_id?: string | null;
  product_id?: string | null;
  entitlement_ids?: string[] | null;
  expiration_at_ms?: number | null;
  purchased_at_ms?: number | null;
  transaction_id?: string | null;
  original_transaction_id?: string | null;
  store?: string | null;
}

function mustGetEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) {
    throw new Error(`${name} is not configured`);
  }
  return value;
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": APP_URL,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders(),
    },
  });
}

function toIsoFromMs(value: number | null | undefined) {
  return typeof value === "number" ? new Date(value).toISOString() : null;
}

function getEventType(event: RevenueCatEvent) {
  return (event.type ?? "").toUpperCase();
}

function isPremiumEvent(event: RevenueCatEvent) {
  return (event.entitlement_ids ?? []).includes(REVENUECAT_PREMIUM_ENTITLEMENT_ID);
}

function isPremiumActive(event: RevenueCatEvent) {
  const type = getEventType(event);
  const expirationAt = event.expiration_at_ms ?? null;

  if (type === "EXPIRATION") return false;
  if (expirationAt == null) return true;
  return expirationAt > Date.now();
}

async function hasProcessedEvent(eventId: string) {
  const { data } = await supabase
    .from("billing_webhook_events")
    .select("event_id")
    .eq("provider", "revenuecat")
    .eq("event_id", eventId)
    .maybeSingle();

  return !!data;
}

async function recordProcessedEvent(eventId: string, payload: unknown) {
  await supabase.from("billing_webhook_events").upsert({
    provider: "revenuecat",
    event_id: eventId,
    payload,
  });
}

async function upsertRevenueCatCustomer(memberId: string, appUserId: string | null, originalAppUserId: string | null) {
  await supabase.from("billing_customers").upsert(
    {
      member_id: memberId,
      revenuecat_app_user_id: appUserId,
      revenuecat_original_app_user_id: originalAppUserId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "member_id" }
  );
}

async function upsertPremiumEntitlement(params: {
  memberId: string;
  active: boolean;
  startedAt: string | null;
  expiresAt: string | null;
  originalTransactionRef: string | null;
}) {
  await supabase.from("member_entitlements").upsert(
    {
      member_id: params.memberId,
      premium_active: params.active,
      source: "apple",
      started_at: params.startedAt,
      expires_at: params.expiresAt,
      original_transaction_ref: params.originalTransactionRef,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "member_id" }
  );
}

async function grantHostCredit(memberId: string, purchaseRef: string, event: RevenueCatEvent) {
  await supabase.from("host_credit_ledger").insert({
    member_id: memberId,
    delta: 1,
    source: "apple",
    purchase_ref: purchaseRef,
    metadata: {
      product_id: event.product_id,
      transaction_id: event.transaction_id,
      store: event.store,
    },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders() });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  if (REVENUECAT_WEBHOOK_AUTH) {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (authHeader !== `Bearer ${REVENUECAT_WEBHOOK_AUTH}`) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }
  }

  const payload = (await req.json().catch(() => ({}))) as RevenueCatEventEnvelope | RevenueCatEvent;
  const event = "event" in payload ? payload.event : payload;
  if (!event) {
    return jsonResponse({ error: "Missing RevenueCat event payload" }, 400);
  }

  const eventId =
    event.id ??
    [event.type, event.transaction_id ?? event.original_transaction_id ?? event.product_id ?? crypto.randomUUID()]
      .filter(Boolean)
      .join(":");

  if (await hasProcessedEvent(eventId)) {
    return jsonResponse({ received: true, duplicate: true });
  }

  const memberId = event.app_user_id;
  if (!memberId) {
    return jsonResponse({ error: "RevenueCat event missing app_user_id" }, 400);
  }

  try {
    await upsertRevenueCatCustomer(memberId, event.app_user_id ?? null, event.original_app_user_id ?? null);

    if (event.product_id === REVENUECAT_HOST_CREDIT_PRODUCT_ID) {
      const type = getEventType(event);
      const purchaseRef = event.transaction_id ?? event.original_transaction_id ?? eventId;

      if (type === "NON_SUBSCRIPTION_PURCHASE" || type === "INITIAL_PURCHASE") {
        await grantHostCredit(memberId, purchaseRef, event);
      }
    }

    if (isPremiumEvent(event)) {
      await upsertPremiumEntitlement({
        memberId,
        active: isPremiumActive(event),
        startedAt: toIsoFromMs(event.purchased_at_ms),
        expiresAt: toIsoFromMs(event.expiration_at_ms),
        originalTransactionRef: event.original_transaction_id ?? event.transaction_id ?? null,
      });
    }

    await recordProcessedEvent(eventId, payload);
    return jsonResponse({ received: true });
  } catch (error) {
    console.error("[billing-revenuecat-webhook] processing failed", error);
    return jsonResponse(
      { error: error instanceof Error ? error.message : "RevenueCat webhook processing failed" },
      500
    );
  }
});
