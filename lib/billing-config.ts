export type NativePurchasesPlatform = "ios" | "android";
export type BillingSource = "native_ios" | "native_android" | "stripe";

type EnvSource = Record<string, string | undefined>;

const DEFAULT_ENV = {
  EXPO_PUBLIC_REVENUECAT_IOS_API_KEY: process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY,
  EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY,
  EXPO_PUBLIC_REVENUECAT_PREMIUM_PACKAGE_ID: process.env.EXPO_PUBLIC_REVENUECAT_PREMIUM_PACKAGE_ID,
  EXPO_PUBLIC_REVENUECAT_HOST_CREDIT_PRODUCT_ID: process.env.EXPO_PUBLIC_REVENUECAT_HOST_CREDIT_PRODUCT_ID,
  EXPO_PUBLIC_REVENUECAT_ANDROID_PREMIUM_PACKAGE_ID: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_PREMIUM_PACKAGE_ID,
  EXPO_PUBLIC_REVENUECAT_ANDROID_HOST_CREDIT_PRODUCT_ID: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_HOST_CREDIT_PRODUCT_ID,
} as const;

function getTrimmedEnvValue(value: string | undefined): string {
  return value?.trim() ?? "";
}

export function isNativePurchasesPlatform(platformOS: string): platformOS is NativePurchasesPlatform {
  return platformOS === "ios" || platformOS === "android";
}

export function getBillingSource(platformOS: string): BillingSource {
  if (platformOS === "ios") return "native_ios";
  if (platformOS === "android") return "native_android";
  return "stripe";
}

export function getRevenueCatApiKey(
  platformOS: string,
  env: EnvSource = DEFAULT_ENV
): string {
  if (platformOS === "ios") {
    return getTrimmedEnvValue(env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY);
  }

  if (platformOS === "android") {
    return getTrimmedEnvValue(env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY);
  }

  return "";
}

export function getRevenueCatPremiumPackageId(
  platformOS: string,
  env: EnvSource = DEFAULT_ENV
): string {
  if (platformOS === "android") {
    const androidPackageId = getTrimmedEnvValue(env.EXPO_PUBLIC_REVENUECAT_ANDROID_PREMIUM_PACKAGE_ID);
    if (androidPackageId) return androidPackageId;
  }

  return getTrimmedEnvValue(env.EXPO_PUBLIC_REVENUECAT_PREMIUM_PACKAGE_ID);
}

export function getRevenueCatHostCreditProductId(
  platformOS: string,
  env: EnvSource = DEFAULT_ENV
): string {
  if (platformOS === "android") {
    const androidProductId = getTrimmedEnvValue(env.EXPO_PUBLIC_REVENUECAT_ANDROID_HOST_CREDIT_PRODUCT_ID);
    if (androidProductId) return androidProductId;
  }

  return getTrimmedEnvValue(env.EXPO_PUBLIC_REVENUECAT_HOST_CREDIT_PRODUCT_ID);
}
