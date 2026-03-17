import { Linking, Platform } from "react-native";
import * as Expo from "expo";

import {
  getRevenueCatApiKey,
  getRevenueCatHostCreditProductId,
  getRevenueCatPremiumPackageId,
  isNativePurchasesPlatform,
} from "@/lib/billing-config";
import { supabase } from "@/lib/supabase";
import type { Database } from "@/types/database";

export type BillingStatus = Database["public"]["Functions"]["get_my_billing_status"]["Returns"][number];
export type CheckoutKind = "premium" | "host_credit";
export type BillingOperation = CheckoutKind | "restore";
export type EffectiveBillingAccess = {
  hasAdminBillingBypass: boolean;
  effectivePremiumActive: boolean;
  effectiveHostingAccess: boolean;
  billingAccessLabel: string | null;
};
export type BillingFailureCode =
  | "PURCHASE_CANCELLED"
  | "PRODUCT_ALREADY_PURCHASED"
  | "PURCHASE_NOT_ALLOWED"
  | "STORE_PROBLEM"
  | "RECEIPT_ALREADY_IN_USE"
  | "NATIVE_PURCHASES_DISABLED"
  | "UNKNOWN";
export type BillingErrorMetadata = {
  normalizedCode: BillingFailureCode;
  operation: BillingOperation | null;
  platform: string;
  revenueCatCode: string | null;
  userCancelled: boolean;
  packageIdentifier: string | null;
  productIdentifier: string | null;
  memberId: string | null;
  revenueCatAppUserId: string | null;
  canMakePayments: boolean | null;
  debugMessage: string | null;
};

type BillingErrorContext = {
  operation?: BillingOperation | null;
  packageIdentifier?: string | null;
  productIdentifier?: string | null;
  memberId?: string | null;
  revenueCatAppUserId?: string | null;
  canMakePayments?: boolean | null;
  platform?: string;
};

const PURCHASES_ERROR_CODES = {
  PURCHASE_CANCELLED_ERROR: "PURCHASE_CANCELLED_ERROR",
  PRODUCT_ALREADY_PURCHASED_ERROR: "PRODUCT_ALREADY_PURCHASED_ERROR",
  PURCHASE_NOT_ALLOWED_ERROR: "PURCHASE_NOT_ALLOWED_ERROR",
  STORE_PROBLEM_ERROR: "STORE_PROBLEM_ERROR",
  RECEIPT_ALREADY_IN_USE_ERROR: "RECEIPT_ALREADY_IN_USE_ERROR",
} as const;

const APP_URL = process.env.EXPO_PUBLIC_APP_URL ?? "https://phina.appsmithery.co";
export const EXPO_GO_NATIVE_PURCHASES_MESSAGE =
  "Native purchases are not available in Expo Go. Install a native development build or use the store-distributed test app to validate purchases.";

let configuredRevenueCatUserId: string | null = null;
let configuredRevenueCatEmail: string | null = null;
let revenueCatConfigurationTargetUserId: string | null = null;
let revenueCatConfigurationPromise: Promise<boolean> | null = null;

export class BillingCheckoutError extends Error {
  readonly metadata: BillingErrorMetadata;

  constructor(message: string, metadata: BillingErrorMetadata) {
    super(message);
    this.name = "BillingCheckoutError";
    this.metadata = metadata;
  }
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getPurchasesModule() {
  if (!isNativePurchasesPlatform(Platform.OS)) return null;
  if (!getNativePurchasesAvailability().nativePurchasesAvailable) return null;
  return import("react-native-purchases");
}

function getErrorString(error: unknown, key: string): string | null {
  if (!error || typeof error !== "object" || !(key in error)) return null;
  const value = (error as Record<string, unknown>)[key];
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function getErrorBoolean(error: unknown, key: string): boolean | null {
  if (!error || typeof error !== "object" || !(key in error)) return null;
  const value = (error as Record<string, unknown>)[key];
  return typeof value === "boolean" ? value : null;
}

function createBillingError(
  message: string,
  metadata: BillingErrorMetadata
): BillingCheckoutError {
  return new BillingCheckoutError(message, metadata);
}

function getBaseBillingMetadata(
  error: unknown,
  context: BillingErrorContext = {}
): BillingErrorMetadata {
  return {
    normalizedCode: "UNKNOWN",
    operation: context.operation ?? null,
    platform: context.platform ?? Platform.OS,
    revenueCatCode: getErrorString(error, "code"),
    userCancelled: getErrorBoolean(error, "userCancelled") === true,
    packageIdentifier: context.packageIdentifier ?? null,
    productIdentifier: context.productIdentifier ?? null,
    memberId: context.memberId ?? null,
    revenueCatAppUserId: context.revenueCatAppUserId ?? configuredRevenueCatUserId ?? null,
    canMakePayments: context.canMakePayments ?? null,
    debugMessage: error instanceof Error ? error.message : getErrorString(error, "message"),
  };
}

export function getBillingErrorMetadata(error: unknown): BillingErrorMetadata {
  if (error instanceof BillingCheckoutError) {
    return error.metadata;
  }

  return getBaseBillingMetadata(error);
}

export function normalizeBillingError(
  error: unknown,
  context: BillingErrorContext = {}
): BillingCheckoutError {
  if (error instanceof BillingCheckoutError) {
    return error;
  }

  const metadata = getBaseBillingMetadata(error, context);

  if (metadata.canMakePayments === false) {
    metadata.normalizedCode = "PURCHASE_NOT_ALLOWED";
    return createBillingError(
      "Purchases are not allowed on this device. Check Screen Time and App Store purchase restrictions, then confirm your Sandbox Apple Account is signed in under Settings > Developer.",
      metadata
    );
  }

  switch (metadata.revenueCatCode) {
    case PURCHASES_ERROR_CODES.PURCHASE_CANCELLED_ERROR:
      metadata.normalizedCode = "PURCHASE_CANCELLED";
      if (metadata.platform === "ios" && metadata.operation === "premium") {
        return createBillingError(
          "The purchase did not complete. This Apple sandbox account may already own Premium. Try Restore or use a fresh sandbox tester.",
          metadata
        );
      }
      return createBillingError("Purchase was cancelled.", metadata);
    case PURCHASES_ERROR_CODES.PRODUCT_ALREADY_PURCHASED_ERROR:
      metadata.normalizedCode = "PRODUCT_ALREADY_PURCHASED";
      return createBillingError(
        "This Apple sandbox account already owns this purchase. Try Restore or use a fresh sandbox tester.",
        metadata
      );
    case PURCHASES_ERROR_CODES.PURCHASE_NOT_ALLOWED_ERROR:
      metadata.normalizedCode = "PURCHASE_NOT_ALLOWED";
      return createBillingError(
        "Purchases are not allowed on this device. Check Screen Time and App Store purchase restrictions, then confirm your Sandbox Apple Account is signed in under Settings > Developer.",
        metadata
      );
    case PURCHASES_ERROR_CODES.STORE_PROBLEM_ERROR:
      metadata.normalizedCode = "STORE_PROBLEM";
      return createBillingError(
        "The App Store could not complete the purchase right now. Retry in a moment. Apple sandbox can be unreliable.",
        metadata
      );
    case PURCHASES_ERROR_CODES.RECEIPT_ALREADY_IN_USE_ERROR:
      metadata.normalizedCode = "RECEIPT_ALREADY_IN_USE";
      return createBillingError(
        "This purchase receipt is already linked to another account. Try Restore first. If it still fails, use the original account or a fresh sandbox tester.",
        metadata
      );
    default:
      metadata.normalizedCode = "UNKNOWN";
      return createBillingError(
        metadata.debugMessage ?? "Could not complete the purchase right now.",
        metadata
      );
  }
}

export async function assertCanMakePayments(
  Purchases: { canMakePayments?: () => Promise<boolean> },
  context: BillingErrorContext
): Promise<void> {
  if (typeof Purchases.canMakePayments !== "function") return;

  const canMakePayments = await Purchases.canMakePayments().catch(() => true);
  if (canMakePayments) return;

  throw createBillingError(
    "Purchases are not allowed on this device. Check Screen Time and App Store purchase restrictions, then confirm your Sandbox Apple Account is signed in under Settings > Developer.",
    {
      ...getBaseBillingMetadata(null, context),
      normalizedCode: "PURCHASE_NOT_ALLOWED",
      canMakePayments: false,
    }
  );
}

export function getNativePurchasesAvailability(): {
  nativePurchasesAvailable: boolean;
  unsupportedReason: string | null;
} {
  if (!isNativePurchasesPlatform(Platform.OS)) {
    return {
      nativePurchasesAvailable: false,
      unsupportedReason: null,
    };
  }

  if (typeof Expo.isRunningInExpoGo === "function" && Expo.isRunningInExpoGo()) {
    return {
      nativePurchasesAvailable: false,
      unsupportedReason: EXPO_GO_NATIVE_PURCHASES_MESSAGE,
    };
  }

  if (!getRevenueCatApiKey(Platform.OS)) {
    return {
      nativePurchasesAvailable: false,
      unsupportedReason: `RevenueCat is not configured for this ${Platform.OS === "android" ? "Android" : "iOS"} build.`,
    };
  }

  return {
    nativePurchasesAvailable: true,
    unsupportedReason: null,
  };
}

function getUnsupportedNativePurchasesError() {
  const { unsupportedReason } = getNativePurchasesAvailability();
  return createBillingError(
    unsupportedReason ?? "RevenueCat is not configured for native purchases.",
    {
      normalizedCode: "NATIVE_PURCHASES_DISABLED",
      operation: null,
      platform: Platform.OS,
      revenueCatCode: null,
      userCancelled: false,
      packageIdentifier: null,
      productIdentifier: null,
      memberId: null,
      revenueCatAppUserId: configuredRevenueCatUserId,
      canMakePayments: null,
      debugMessage: unsupportedReason ?? "RevenueCat is not configured for native purchases.",
    }
  );
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

export function getEffectiveBillingAccess(
  status: BillingStatus | null | undefined,
  isAdmin: boolean | null | undefined
): EffectiveBillingAccess {
  const hasAdminBillingBypass = isAdmin === true;
  const premiumActive = isPremiumActive(status);
  const hostCreditBalance = status?.host_credit_balance ?? 0;

  return {
    hasAdminBillingBypass,
    effectivePremiumActive: hasAdminBillingBypass || premiumActive,
    effectiveHostingAccess: hasAdminBillingBypass || hostCreditBalance > 0,
    billingAccessLabel: hasAdminBillingBypass ? "Admin override" : null,
  };
}

export async function fetchBillingStatus(): Promise<BillingStatus> {
  const { data, error } = await supabase.rpc("get_my_billing_status");
  if (error) throw error;
  return data?.[0] ?? getDefaultBillingStatus();
}

export async function configureRevenueCatForMember(memberId: string, email?: string | null): Promise<boolean> {
  if (!isNativePurchasesPlatform(Platform.OS)) return false;
  if (!getNativePurchasesAvailability().nativePurchasesAvailable) return false;

  if (
    configuredRevenueCatUserId === memberId &&
    (!email || configuredRevenueCatEmail === email) &&
    revenueCatConfigurationPromise === null
  ) {
    return true;
  }

  if (revenueCatConfigurationPromise && revenueCatConfigurationTargetUserId === memberId) {
    return revenueCatConfigurationPromise;
  }

  const configurePromise = (async () => {
    const PurchasesModule = await getPurchasesModule();
    if (!PurchasesModule) return false;

    const Purchases = PurchasesModule.default;
    await Purchases.setLogLevel(PurchasesModule.LOG_LEVEL.WARN).catch(() => {});
    const apiKey = getRevenueCatApiKey(Platform.OS);
    if (!apiKey) return false;

    const isConfigured = await Purchases.isConfigured();

    if (!isConfigured) {
      Purchases.configure({ apiKey, appUserID: memberId });
      configuredRevenueCatUserId = memberId;
    } else {
      const currentAppUserId = await Purchases.getAppUserID().catch(() => configuredRevenueCatUserId ?? memberId);
      configuredRevenueCatUserId = currentAppUserId;

      if (currentAppUserId !== memberId) {
        await Purchases.logIn(memberId);
        configuredRevenueCatUserId = memberId;
      }
    }

    if (email && configuredRevenueCatEmail !== email) {
      await Purchases.setEmail(email).catch(() => {});
      configuredRevenueCatEmail = email;
    }

    if (!email) {
      configuredRevenueCatEmail = null;
    }

    return true;
  })();

  revenueCatConfigurationTargetUserId = memberId;
  revenueCatConfigurationPromise = configurePromise;

  try {
    return await configurePromise;
  } finally {
    if (revenueCatConfigurationPromise === configurePromise) {
      revenueCatConfigurationPromise = null;
      revenueCatConfigurationTargetUserId = null;
    }
  }
}

export async function resetRevenueCatUser(): Promise<void> {
  if (!isNativePurchasesPlatform(Platform.OS)) return;

  const PurchasesModule = await getPurchasesModule();
  if (!PurchasesModule) return;

  const Purchases = PurchasesModule.default;
  const isConfigured = await Purchases.isConfigured();
  if (!isConfigured) {
    configuredRevenueCatUserId = null;
    configuredRevenueCatEmail = null;
    return;
  }

  try {
    await Purchases.logOut();
  } catch {
    // Ignore logout issues during sign-out.
  } finally {
    configuredRevenueCatUserId = null;
    configuredRevenueCatEmail = null;
    revenueCatConfigurationPromise = null;
    revenueCatConfigurationTargetUserId = null;
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

function getPremiumPackage(offerings: any) {
  const currentOffering = offerings.current;
  if (!currentOffering) return null;
  const premiumPackageId = getRevenueCatPremiumPackageId(Platform.OS);

  if (premiumPackageId) {
    const explicitMatch = currentOffering.availablePackages.find(
      (pkg: { identifier: string }) => pkg.identifier === premiumPackageId
    );
    if (explicitMatch) return explicitMatch;
  }

  return currentOffering.monthly ?? currentOffering.availablePackages[0] ?? null;
}

export async function purchasePremium(memberId: string, email?: string | null): Promise<void> {
  if (Platform.OS === "web") {
    await startStripeCheckout("premium");
    return;
  }

  if (!getNativePurchasesAvailability().nativePurchasesAvailable) {
    throw getUnsupportedNativePurchasesError();
  }

  const configured = await configureRevenueCatForMember(memberId, email);
  if (!configured) {
    throw getUnsupportedNativePurchasesError();
  }

  const PurchasesModule = await getPurchasesModule();
  if (!PurchasesModule) throw new Error("Purchases SDK is unavailable.");

  const Purchases = PurchasesModule.default;
  let premiumPackage: any = null;

  try {
    await assertCanMakePayments(Purchases, {
      operation: "premium",
      memberId,
      revenueCatAppUserId: configuredRevenueCatUserId ?? memberId,
    });
    const offerings = await Purchases.getOfferings();
    premiumPackage = getPremiumPackage(offerings);

    if (!premiumPackage) {
      throw new Error("Premium subscription is not configured in RevenueCat.");
    }

    await Purchases.purchasePackage(premiumPackage);
  } catch (error) {
    if (error instanceof Error && error.message === "Premium subscription is not configured in RevenueCat.") {
      throw error;
    }

    throw normalizeBillingError(error, {
      operation: "premium",
      packageIdentifier: premiumPackage?.identifier ?? null,
      memberId,
      revenueCatAppUserId: configuredRevenueCatUserId ?? memberId,
    });
  }
}

export async function purchaseHostCredit(memberId: string, email?: string | null): Promise<void> {
  if (Platform.OS === "web") {
    await startStripeCheckout("host_credit");
    return;
  }

  if (!getNativePurchasesAvailability().nativePurchasesAvailable) {
    throw getUnsupportedNativePurchasesError();
  }

  const hostCreditProductId = getRevenueCatHostCreditProductId(Platform.OS);
  if (!hostCreditProductId) {
    throw new Error("Host credit product is not configured.");
  }

  const configured = await configureRevenueCatForMember(memberId, email);
  if (!configured) {
    throw getUnsupportedNativePurchasesError();
  }

  const PurchasesModule = await getPurchasesModule();
  if (!PurchasesModule) throw new Error("Purchases SDK is unavailable.");

  const Purchases = PurchasesModule.default;
  let hostCreditProduct: any = null;

  try {
    await assertCanMakePayments(Purchases, {
      operation: "host_credit",
      memberId,
      productIdentifier: hostCreditProductId,
      revenueCatAppUserId: configuredRevenueCatUserId ?? memberId,
    });
    const products = await Purchases.getProducts(
      [hostCreditProductId],
      PurchasesModule.PURCHASE_TYPE.INAPP
    );
    hostCreditProduct = products[0];

    if (!hostCreditProduct) {
      throw new Error("Host credit product is not available in RevenueCat.");
    }

    await Purchases.purchaseStoreProduct(hostCreditProduct);
  } catch (error) {
    if (error instanceof Error && error.message === "Host credit product is not available in RevenueCat.") {
      throw error;
    }

    throw normalizeBillingError(error, {
      operation: "host_credit",
      productIdentifier: hostCreditProduct?.identifier ?? hostCreditProductId,
      memberId,
      revenueCatAppUserId: configuredRevenueCatUserId ?? memberId,
    });
  }
}

export async function restoreNativePurchases(memberId: string, email?: string | null): Promise<void> {
  if (!isNativePurchasesPlatform(Platform.OS)) return;

  if (!getNativePurchasesAvailability().nativePurchasesAvailable) {
    throw getUnsupportedNativePurchasesError();
  }

  const configured = await configureRevenueCatForMember(memberId, email);
  if (!configured) {
    throw getUnsupportedNativePurchasesError();
  }

  const PurchasesModule = await getPurchasesModule();
  if (!PurchasesModule) throw new Error("Purchases SDK is unavailable.");

  try {
    await assertCanMakePayments(PurchasesModule.default, {
      operation: "restore",
      memberId,
      revenueCatAppUserId: configuredRevenueCatUserId ?? memberId,
    });
    await PurchasesModule.default.restorePurchases();
  } catch (error) {
    throw normalizeBillingError(error, {
      operation: "restore",
      memberId,
      revenueCatAppUserId: configuredRevenueCatUserId ?? memberId,
    });
  }
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
