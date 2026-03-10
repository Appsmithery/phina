import Stripe from "npm:stripe@20.4.1";
import { createClient } from "npm:@supabase/supabase-js@2.99.0";

const APP_URL = Deno.env.get("APP_URL") ?? "https://phina.appsmithery.co";
const SUPABASE_URL = mustGetEnv("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = mustGetEnv("SUPABASE_SERVICE_ROLE_KEY");
const STRIPE_SECRET_KEY = mustGetEnv("STRIPE_SECRET_KEY");
const STRIPE_WEBHOOK_SIGNING_SECRET = mustGetEnv("STRIPE_WEBHOOK_SIGNING_SECRET");

const stripe = new Stripe(STRIPE_SECRET_KEY, {
  httpClient: Stripe.createFetchHttpClient(),
});

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

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
    "Access-Control-Allow-Headers": "Content-Type, Stripe-Signature",
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

async function hasProcessedEvent(eventId: string) {
  const { data } = await supabase
    .from("billing_webhook_events")
    .select("event_id")
    .eq("provider", "stripe")
    .eq("event_id", eventId)
    .maybeSingle();

  return !!data;
}

async function recordProcessedEvent(eventId: string, payload: unknown) {
  await supabase.from("billing_webhook_events").upsert({
    provider: "stripe",
    event_id: eventId,
    payload,
  });
}

async function upsertStripeCustomer(memberId: string, stripeCustomerId: string | null) {
  if (!stripeCustomerId) return;

  await supabase.from("billing_customers").upsert(
    {
      member_id: memberId,
      stripe_customer_id: stripeCustomerId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "member_id" }
  );
}

async function getMemberIdForStripeCustomer(
  stripeCustomerId: string | null,
  fallbackMemberId?: string | null
): Promise<string | null> {
  if (stripeCustomerId) {
    const { data } = await supabase
      .from("billing_customers")
      .select("member_id")
      .eq("stripe_customer_id", stripeCustomerId)
      .maybeSingle();

    if (data?.member_id) return data.member_id;
  }

  return fallbackMemberId ?? null;
}

async function grantHostCredit(memberId: string, purchaseRef: string, payload: Record<string, unknown>) {
  await supabase.from("host_credit_ledger").insert({
    member_id: memberId,
    delta: 1,
    source: "stripe",
    purchase_ref: purchaseRef,
    metadata: payload,
  });
}

async function upsertPremiumEntitlement(params: {
  memberId: string;
  active: boolean;
  source: "stripe";
  startedAt: string | null;
  expiresAt: string | null;
  originalTransactionRef: string | null;
}) {
  await supabase.from("member_entitlements").upsert(
    {
      member_id: params.memberId,
      premium_active: params.active,
      source: params.source,
      started_at: params.startedAt,
      expires_at: params.expiresAt,
      original_transaction_ref: params.originalTransactionRef,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "member_id" }
  );
}

function stripeTimestampToIso(value: number | null | undefined) {
  return typeof value === "number" ? new Date(value * 1000).toISOString() : null;
}

function isStripeSubscriptionActive(status: Stripe.Subscription.Status) {
  return status === "active" || status === "trialing" || status === "past_due";
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders() });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const signature = req.headers.get("Stripe-Signature");
  if (!signature) {
    return jsonResponse({ error: "Missing Stripe-Signature header" }, 400);
  }

  const body = await req.text();

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, STRIPE_WEBHOOK_SIGNING_SECRET);
  } catch (error) {
    return jsonResponse(
      { error: error instanceof Error ? error.message : "Invalid Stripe webhook signature" },
      400
    );
  }

  if (await hasProcessedEvent(event.id)) {
    return jsonResponse({ received: true, duplicate: true });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const stripeCustomerId = typeof session.customer === "string" ? session.customer : session.customer?.id ?? null;
        const memberId = await getMemberIdForStripeCustomer(
          stripeCustomerId,
          session.metadata?.member_id ?? session.client_reference_id ?? null
        );

        if (memberId) {
          await upsertStripeCustomer(memberId, stripeCustomerId);
        }

        if (
          memberId &&
          session.metadata?.kind === "host_credit" &&
          session.payment_status === "paid"
        ) {
          await grantHostCredit(memberId, session.id, {
            checkout_session_id: session.id,
            amount_total: session.amount_total ?? null,
          });
        }

        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const stripeCustomerId =
          typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;
        const memberId = await getMemberIdForStripeCustomer(
          stripeCustomerId,
          subscription.metadata?.member_id ?? null
        );

        if (!memberId) break;

        await upsertStripeCustomer(memberId, stripeCustomerId);
        await upsertPremiumEntitlement({
          memberId,
          active: isStripeSubscriptionActive(subscription.status),
          source: "stripe",
          startedAt: stripeTimestampToIso(subscription.start_date),
          expiresAt: stripeTimestampToIso(subscription.current_period_end),
          originalTransactionRef: subscription.id,
        });
        break;
      }
      default:
        break;
    }

    await recordProcessedEvent(event.id, event);
    return jsonResponse({ received: true });
  } catch (error) {
    console.error("[billing-stripe-webhook] processing failed", error);
    return jsonResponse(
      { error: error instanceof Error ? error.message : "Stripe webhook processing failed" },
      500
    );
  }
});
