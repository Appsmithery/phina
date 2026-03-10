import { Linking, Platform } from "react-native";

import { supabase } from "@/lib/supabase";
import type { Database } from "@/types/database";

export type BillingStatus = Database["public"]["Functions"]["get_my_billing_status"]["Returns"][number];
export type CheckoutKind = "premium" | "host_credit";

const APP_URL = process.env.EXPO_PUBLIC_APP_URL ?? "https://phina.appsmithery.co";
const REVENUECAT_IOS_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY ?? "";
const REVENUECAT_PREMIUM_PACKAGE_ID = process.env.EXPO_PUBLIC_REVENUECAT_PREMIUM_PACKAGE_ID ?? "";
const REVENUECAT_HOST_CREDIT_PRODUCT_ID = process.env.EXPO_PUBLIC_REVENUECAT_HOST_CREDIT_PRODUCT_ID ?? "";

let configuredRevenueCatUserId: string | null = null;

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getPurchasesModule() {
  if (Platform.OS !== "ios") return null;
  return import("react-native-purchases");
}

export function getDefaultBillingStatus(): BillingStatus {
  return {
    premium_active: false,
    premium_source: "none",
    premium_expires_at: null,
    host_credit_balance: 0,
  };
}

export function isPremiumActive(status: BillingStatus | null | undefined): boolean {
  if (!status?.premium_active) return false;
  if (!status.premium_expires_at) return true;
  return new Date(status.premium_expires_at).getTime() > Date.now();
}

export async function fetchBillingStatus(): Promise<BillingStatus> {
  const { data, error } = await supabase.rpc("get_my_billing_status");
  if (error) throw error;
  return data?.[0] ?? getDefaultBillingStatus();
}

export async function configureRevenueCatForMember(memberId: string, email?: string | null): Promise<boolean> {
  if (Platform.OS !== "ios" || !REVENUECAT_IOS_API_KEY) return false;

  const PurchasesModule = await getPurchasesModule();
  if (!PurchasesModule) return false;

  const Purchases = PurchasesModule.default;
  const isConfigured = await Purchases.isConfigured();

  if (!isConfigured) {
    Purchases.setLogLevel(__DEV__ ? PurchasesModule.LOG_LEVEL.DEBUG : PurchasesModule.LOG_LEVEL.WARN);
    Purchases.configure({ apiKey: REVENUECAT_IOS_API_KEY, appUserID: memberId });
    configuredRevenueCatUserId = memberId;
  } else if (configuredRevenueCatUserId !== memberId) {
    await Purchases.logIn(memberId);
    configuredRevenueCatUserId = memberId;
  }

  if (email) {
    await Purchases.setEmail(email).catch(() => {});
  }

  return true;
}

export async function resetRevenueCatUser(): Promise<void> {
  if (Platform.OS !== "ios") return;

  const PurchasesModule = await getPurchasesModule();
  if (!PurchasesModule) return;

  const Purchases = PurchasesModule.default;
  const isConfigured = await Purchases.isConfigured();
  if (!isConfigured) {
    configuredRevenueCatUserId = null;
    return;
  }

  try {
    await Purchases.logOut();
  } catch {
    // Ignore logout issues during sign-out.
  } finally {
    configuredRevenueCatUserId = null;
  }
}

function getStripeReturnUrl(kind: CheckoutKind, state: "success" | "cancel") {
  return `${APP_URL}/profile?billing=${state}&kind=${kind}`;
}

async function openExternalUrl(url: string) {
  if (Platform.OS === "web" && typeof window !== "undefined") {
    window.location.assign(url);
    return;
  }
  await Linking.openURL(url);
}

export async function startStripeCheckout(kind: CheckoutKind): Promise<void> {
  const { data, error } = await supabase.functions.invoke("create-stripe-checkout-session", {
    body: {
      kind,
      successUrl: getStripeReturnUrl(kind, "success"),
      cancelUrl: getStripeReturnUrl(kind, "cancel"),
    },
  });

  if (error) throw error;

  const checkoutUrl = data && typeof data === "object" && "url" in data ? String(data.url) : "";
  if (!checkoutUrl) {
    throw new Error("Stripe checkout URL was not returned.");
  }

  await openExternalUrl(checkoutUrl);
}

function getPremiumPackage(
  offerings: Awaited<ReturnType<NonNullable<Awaited<ReturnType<typeof getPurchasesModule>>>["default"]["getOfferings"]>>
) {
  const currentOffering = offerings.current;
  if (!currentOffering) return null;

  if (REVENUECAT_PREMIUM_PACKAGE_ID) {
    const explicitMatch = currentOffering.availablePackages.find(
      (pkg) => pkg.identifier === REVENUECAT_PREMIUM_PACKAGE_ID
    );
    if (explicitMatch) return explicitMatch;
  }

  return currentOffering.monthly ?? currentOffering.availablePackages[0] ?? null;
}

export async function purchasePremium(memberId: string, email?: string | null): Promise<void> {
  if (Platform.OS !== "ios") {
    await startStripeCheckout("premium");
    return;
  }

  const configured = await configureRevenueCatForMember(memberId, email);
  if (!configured) {
    throw new Error("RevenueCat is not configured for iOS purchases.");
  }

  const PurchasesModule = await getPurchasesModule();
  if (!PurchasesModule) throw new Error("Purchases SDK is unavailable.");

  const Purchases = PurchasesModule.default;
  const offerings = await Purchases.getOfferings();
  const premiumPackage = getPremiumPackage(offerings);

  if (!premiumPackage) {
    throw new Error("Premium subscription is not configured in RevenueCat.");
  }

  await Purchases.purchasePackage(premiumPackage);
}

export async function purchaseHostCredit(memberId: string, email?: string | null): Promise<void> {
  if (Platform.OS !== "ios") {
    await startStripeCheckout("host_credit");
    return;
  }

  if (!REVENUECAT_HOST_CREDIT_PRODUCT_ID) {
    throw new Error("Host credit product is not configured.");
  }

  const configured = await configureRevenueCatForMember(memberId, email);
  if (!configured) {
    throw new Error("RevenueCat is not configured for iOS purchases.");
  }

  const PurchasesModule = await getPurchasesModule();
  if (!PurchasesModule) throw new Error("Purchases SDK is unavailable.");

  const Purchases = PurchasesModule.default;
  const products = await Purchases.getProducts(
    [REVENUECAT_HOST_CREDIT_PRODUCT_ID],
    PurchasesModule.PURCHASE_TYPE.INAPP
  );
  const hostCreditProduct = products[0];

  if (!hostCreditProduct) {
    throw new Error("Host credit product is not available in RevenueCat.");
  }

  await Purchases.purchaseStoreProduct(hostCreditProduct);
}

export async function restoreNativePurchases(memberId: string, email?: string | null): Promise<void> {
  if (Platform.OS !== "ios") return;

  const configured = await configureRevenueCatForMember(memberId, email);
  if (!configured) {
    throw new Error("RevenueCat is not configured for iOS purchases.");
  }

  const PurchasesModule = await getPurchasesModule();
  if (!PurchasesModule) throw new Error("Purchases SDK is unavailable.");

  await PurchasesModule.default.restorePurchases();
}

export async function pollBillingStatus(
  predicate: (status: BillingStatus) => boolean,
  attempts = 12,
  delayMs = 1500
): Promise<BillingStatus> {
  let latest = await fetchBillingStatus();

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (predicate(latest)) return latest;
    await wait(delayMs);
    latest = await fetchBillingStatus();
  }

  return latest;
}
