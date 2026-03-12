import {
  getBillingSource,
  getRevenueCatApiKey,
  getRevenueCatHostCreditProductId,
  getRevenueCatPremiumPackageId,
  isNativePurchasesPlatform,
} from "@/lib/billing-config";

describe("billing-config helpers", () => {
  const env = {
    EXPO_PUBLIC_REVENUECAT_IOS_API_KEY: "appl_ios_key",
    EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY: "goog_android_key",
    EXPO_PUBLIC_REVENUECAT_PREMIUM_PACKAGE_ID: "$rc_monthly",
    EXPO_PUBLIC_REVENUECAT_HOST_CREDIT_PRODUCT_ID: "phina_host_credit_1",
    EXPO_PUBLIC_REVENUECAT_ANDROID_PREMIUM_PACKAGE_ID: "android_monthly",
    EXPO_PUBLIC_REVENUECAT_ANDROID_HOST_CREDIT_PRODUCT_ID: "android_host_credit_1",
  };

  it("detects native billing platforms", () => {
    expect(isNativePurchasesPlatform("ios")).toBe(true);
    expect(isNativePurchasesPlatform("android")).toBe(true);
    expect(isNativePurchasesPlatform("web")).toBe(false);
  });

  it("maps billing analytics sources by platform", () => {
    expect(getBillingSource("ios")).toBe("native_ios");
    expect(getBillingSource("android")).toBe("native_android");
    expect(getBillingSource("web")).toBe("stripe");
  });

  it("reads the Android RevenueCat API key for Android builds", () => {
    expect(getRevenueCatApiKey("android", env)).toBe("goog_android_key");
    expect(getRevenueCatApiKey("ios", env)).toBe("appl_ios_key");
    expect(getRevenueCatApiKey("web", env)).toBe("");
  });

  it("uses Android-specific RevenueCat product IDs when provided", () => {
    expect(getRevenueCatPremiumPackageId("android", env)).toBe("android_monthly");
    expect(getRevenueCatHostCreditProductId("android", env)).toBe("android_host_credit_1");
  });

  it("falls back to shared RevenueCat product IDs when Android-specific IDs are absent", () => {
    const fallbackEnv = {
      EXPO_PUBLIC_REVENUECAT_PREMIUM_PACKAGE_ID: "$rc_monthly",
      EXPO_PUBLIC_REVENUECAT_HOST_CREDIT_PRODUCT_ID: "phina_host_credit_1",
    };

    expect(getRevenueCatPremiumPackageId("android", fallbackEnv)).toBe("$rc_monthly");
    expect(getRevenueCatHostCreditProductId("android", fallbackEnv)).toBe("phina_host_credit_1");
  });
});
