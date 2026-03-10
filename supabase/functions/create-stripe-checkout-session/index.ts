import Stripe from "npm:stripe@20.4.1";
import { createClient } from "npm:@supabase/supabase-js@2.99.0";

type CheckoutKind = "premium" | "host_credit";

interface CheckoutRequest {
  kind?: CheckoutKind;
  successUrl?: string;
  cancelUrl?: string;
}

const APP_URL = Deno.env.get("APP_URL") ?? "https://phina.appsmithery.co";
const SUPABASE_URL = mustGetEnv("SUPABASE_URL");
const SUPABASE_ANON_KEY = mustGetEnv("SUPABASE_ANON_KEY");
const SUPABASE_SERVICE_ROLE_KEY = mustGetEnv("SUPABASE_SERVICE_ROLE_KEY");
const STRIPE_SECRET_KEY = mustGetEnv("STRIPE_SECRET_KEY");
const STRIPE_PREMIUM_PRICE_ID = mustGetEnv("STRIPE_PREMIUM_PRICE_ID");
const STRIPE_HOST_CREDIT_PRICE_ID = mustGetEnv("STRIPE_HOST_CREDIT_PRICE_ID");

const stripe = new Stripe(STRIPE_SECRET_KEY, {
  httpClient: Stripe.createFetchHttpClient(),
});

type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

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

function jsonResponse(body: Json | Record<string, Json | undefined>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders(),
    },
  });
}

function getCheckoutPriceId(kind: CheckoutKind) {
  return kind === "premium" ? STRIPE_PREMIUM_PRICE_ID : STRIPE_HOST_CREDIT_PRICE_ID;
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

  const authedSupabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const adminSupabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { data: userData, error: userError } = await authedSupabase.auth.getUser();
  if (userError || !userData.user) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  const body = (await req.json().catch(() => ({}))) as CheckoutRequest;
  if (body.kind !== "premium" && body.kind !== "host_credit") {
    return jsonResponse({ error: "Invalid checkout kind" }, 400);
  }

  const memberId = userData.user.id;
  const successUrl = body.successUrl || `${APP_URL}/profile?billing=success&kind=${body.kind}`;
  const cancelUrl = body.cancelUrl || `${APP_URL}/profile?billing=cancel&kind=${body.kind}`;
  const priceId = getCheckoutPriceId(body.kind);

  const { data: customerRow } = await adminSupabase
    .from("billing_customers")
    .select("stripe_customer_id")
    .eq("member_id", memberId)
    .maybeSingle();

  const baseMetadata = {
    member_id: memberId,
    kind: body.kind,
  };

  const sessionParams: Stripe.Checkout.SessionCreateParams = {
    allow_promotion_codes: true,
    cancel_url: cancelUrl,
    success_url: successUrl,
    client_reference_id: memberId,
    customer: customerRow?.stripe_customer_id ?? undefined,
    customer_email: customerRow?.stripe_customer_id ? undefined : userData.user.email ?? undefined,
    line_items: [{ price: priceId, quantity: 1 }],
    metadata: baseMetadata,
    mode: body.kind === "premium" ? "subscription" : "payment",
  };

  if (body.kind === "premium") {
    sessionParams.subscription_data = { metadata: baseMetadata };
  } else {
    sessionParams.payment_intent_data = { metadata: baseMetadata };
  }

  const session = await stripe.checkout.sessions.create(sessionParams);

  return jsonResponse({ url: session.url, id: session.id });
});
