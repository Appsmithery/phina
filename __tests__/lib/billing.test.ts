const mockIsRunningInExpoGo = jest.fn(() => false);
const mockOpenURL = jest.fn();
const mockIsConfigured = jest.fn();
const mockGetAppUserID = jest.fn();
const mockSetLogLevel = jest.fn(() => Promise.resolve());
const mockConfigure = jest.fn();
const mockLogIn = jest.fn(() => Promise.resolve());
const mockSetEmail = jest.fn(() => Promise.resolve());
const mockLogOut = jest.fn(() => Promise.resolve());

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
  __esModule: true,
  isRunningInExpoGo: mockIsRunningInExpoGo,
  default: {
    isRunningInExpoGo: mockIsRunningInExpoGo,
  },
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
  },
  LOG_LEVEL: {
    WARN: "WARN",
  },
  PURCHASE_TYPE: {
    INAPP: "INAPP",
  },
}));

import { getDefaultBillingStatus, getEffectiveBillingAccess, isPremiumActive } from "@/lib/billing";

describe("billing helpers", () => {
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
});
