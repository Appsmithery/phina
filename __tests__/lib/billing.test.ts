const mockIsRunningInExpoGo = jest.fn(() => false);
const mockOpenURL = jest.fn();
const mockIsConfigured = jest.fn();
const mockGetAppUserID = jest.fn();
const mockSetLogLevel = jest.fn(() => Promise.resolve());
const mockConfigure = jest.fn();
const mockLogIn = jest.fn(() => Promise.resolve());
const mockSetEmail = jest.fn(() => Promise.resolve());
const mockLogOut = jest.fn(() => Promise.resolve());
const mockCanMakePayments = jest.fn(() => Promise.resolve(true));
const mockGetOfferings = jest.fn(() =>
  Promise.resolve({
    current: {
      monthly: { identifier: "$rc_monthly" },
      availablePackages: [{ identifier: "$rc_monthly" }],
    },
  })
);
const mockPurchasePackage = jest.fn(() => Promise.resolve());

process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY = "appl_test_key";

jest.mock("@/lib/supabase", () => ({
  supabase: {
    rpc: jest.fn(),
    functions: {
      invoke: jest.fn(),
    },
  },
}));

jest.mock("expo", () => ({
  isRunningInExpoGo: mockIsRunningInExpoGo,
}));

jest.mock("react-native", () => ({
  Linking: {
    openURL: mockOpenURL,
  },
  Platform: {
    OS: "ios",
  },
}));

jest.mock("react-native-purchases", () => ({
  __esModule: true,
  default: {
    isConfigured: mockIsConfigured,
    getAppUserID: mockGetAppUserID,
    setLogLevel: mockSetLogLevel,
    configure: mockConfigure,
    logIn: mockLogIn,
    setEmail: mockSetEmail,
    logOut: mockLogOut,
    canMakePayments: mockCanMakePayments,
    getOfferings: mockGetOfferings,
    purchasePackage: mockPurchasePackage,
  },
  LOG_LEVEL: {
    WARN: "WARN",
  },
  PURCHASE_TYPE: {
    INAPP: "INAPP",
  },
}));

import {
  assertCanMakePayments,
  getBillingErrorMetadata,
  getDefaultBillingStatus,
  getEffectiveBillingAccess,
  isPremiumActive,
  normalizeBillingError,
} from "@/lib/billing";

describe("billing helpers", () => {
  beforeEach(() => {
    mockIsConfigured.mockReset();
    mockGetAppUserID.mockReset();
    mockSetLogLevel.mockClear();
    mockConfigure.mockReset();
    mockLogIn.mockReset();
    mockSetEmail.mockReset();
    mockLogOut.mockReset();
    mockCanMakePayments.mockReset();
    mockGetOfferings.mockReset();
    mockPurchasePackage.mockReset();

    mockIsConfigured.mockResolvedValue(false);
    mockGetAppUserID.mockResolvedValue("member-1");
    mockCanMakePayments.mockResolvedValue(true);
    mockGetOfferings.mockResolvedValue({
      current: {
        monthly: { identifier: "$rc_monthly" },
        availablePackages: [{ identifier: "$rc_monthly" }],
      },
    });
    mockPurchasePackage.mockResolvedValue(undefined);
  });

  it("returns an inactive default billing status", () => {
    expect(getDefaultBillingStatus()).toEqual({
      premium_active: false,
      premium_source: "none",
      premium_expires_at: null,
      host_credit_balance: 0,
    });
  });

  it("treats future-dated premium access as active", () => {
    expect(
      isPremiumActive({
        premium_active: true,
        premium_source: "apple",
        premium_expires_at: new Date(Date.now() + 60_000).toISOString(),
        host_credit_balance: 1,
      })
    ).toBe(true);
  });

  it("treats expired premium access as inactive", () => {
    expect(
      isPremiumActive({
        premium_active: true,
        premium_source: "stripe",
        premium_expires_at: new Date(Date.now() - 60_000).toISOString(),
        host_credit_balance: 0,
      })
    ).toBe(false);
  });

  it("grants admin bypass to premium and hosting access", () => {
    expect(
      getEffectiveBillingAccess(
        {
          premium_active: false,
          premium_source: "none",
          premium_expires_at: null,
          host_credit_balance: 0,
        },
        true
      )
    ).toEqual({
      hasAdminBillingBypass: true,
      effectivePremiumActive: true,
      effectiveHostingAccess: true,
      billingAccessLabel: "Admin override",
    });
  });

  it("keeps hosting access false for unpaid non-admins with no credits", () => {
    expect(
      getEffectiveBillingAccess(
        {
          premium_active: false,
          premium_source: "none",
          premium_expires_at: null,
          host_credit_balance: 0,
        },
        false
      )
    ).toEqual({
      hasAdminBillingBypass: false,
      effectivePremiumActive: false,
      effectiveHostingAccess: false,
      billingAccessLabel: null,
    });
  });

  it("normalizes iOS premium purchase cancellation into sandbox guidance", () => {
    const normalized = normalizeBillingError(
      {
        code: "PURCHASE_CANCELLED_ERROR",
        userCancelled: true,
        message: "Purchase was cancelled.",
      },
      { operation: "premium", memberId: "member-1", revenueCatAppUserId: "member-1" }
    );

    expect(normalized.message).toContain("sandbox account may already own Premium");
    expect(getBillingErrorMetadata(normalized)).toEqual(
      expect.objectContaining({
        normalizedCode: "PURCHASE_CANCELLED",
        operation: "premium",
        memberId: "member-1",
        revenueCatAppUserId: "member-1",
        revenueCatCode: "PURCHASE_CANCELLED_ERROR",
        userCancelled: true,
      })
    );
  });

  it("normalizes already-purchased errors into restore guidance", () => {
    const normalized = normalizeBillingError({
      code: "PRODUCT_ALREADY_PURCHASED_ERROR",
      message: "Already purchased.",
    });

    expect(normalized.message).toContain("already owns this purchase");
    expect(getBillingErrorMetadata(normalized).normalizedCode).toBe("PRODUCT_ALREADY_PURCHASED");
  });

  it("fails early when the device cannot make purchases", async () => {
    mockCanMakePayments.mockResolvedValue(false);

    await expect(
      assertCanMakePayments(
        {
          canMakePayments: mockCanMakePayments,
        },
        { operation: "premium", memberId: "member-1", revenueCatAppUserId: "member-1" }
      )
    ).rejects.toMatchObject({
      name: "BillingCheckoutError",
      message: expect.stringContaining("Purchases are not allowed on this device"),
      metadata: expect.objectContaining({
        normalizedCode: "PURCHASE_NOT_ALLOWED",
        canMakePayments: false,
        operation: "premium",
      }),
    });

    expect(mockGetOfferings).not.toHaveBeenCalled();
    expect(mockPurchasePackage).not.toHaveBeenCalled();
  });
});
