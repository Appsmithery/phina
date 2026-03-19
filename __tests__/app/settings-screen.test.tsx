import React from "react";
import { render, screen } from "@testing-library/react-native";

import SettingsScreen from "@/app/settings";

let mockBillingState = {
  premiumActive: false,
  hostCreditBalance: 0,
  hasAdminBillingBypass: false,
  effectivePremiumActive: false,
  effectiveHostingAccess: false,
  billingAccessLabel: null as string | null,
  nativePurchasesAvailable: false,
  unsupportedReason: "RevenueCat is not configured for this iOS build." as string | null,
  premiumDisplayName: "Premium Monthly",
  premiumDisplayPriceWithPeriod: "$4.99/month",
  hostCreditDisplayPrice: "$10.00",
  isLoading: false,
  isPurchasingPremium: false,
  isPurchasingHostCredit: false,
  isRestoringPurchases: false,
  purchasePremium: jest.fn(),
  purchaseHostCredit: jest.fn(),
  restorePurchases: jest.fn(),
};

jest.mock("expo-router", () => ({
  Stack: { Screen: () => null },
  router: { push: jest.fn(), replace: jest.fn() },
}));

jest.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({
    invalidateQueries: jest.fn(),
  }),
}));

jest.mock("@expo/vector-icons", () => ({
  Ionicons: "Ionicons",
}));

jest.mock("@/components/BirthdayPickerField", () => ({
  BirthdayPickerField: () => null,
}));

jest.mock("@/hooks/use-billing", () => ({
  useBilling: () => mockBillingState,
}));

jest.mock("@/lib/update-diagnostics", () => ({
  getUpdateDiagnostics: () => ({
    channel: "preview",
    runtimeVersion: "1.0.0",
    updateId: "update-123",
    createdAt: "2026-03-18T17:00:00.000Z",
    isEmbeddedLaunch: false,
    isEnabled: true,
  }),
  shouldShowPreviewUpdateDiagnostics: () => true,
}));

jest.mock("@/lib/theme", () => ({
  useTheme: () => ({
    background: "#F2EFE9",
    surface: "#fff",
    text: "#4A3B35",
    textSecondary: "#6B5B54",
    textMuted: "#9A8B82",
    border: "#E5DDD6",
    primary: "#B58271",
  }),
}));

jest.mock("@/lib/supabase-context", () => ({
  useSupabase: () => ({
    member: {
      id: "member-1",
      first_name: "Alex",
      last_name: "Torelli",
      phone: null,
      city: null,
      state: null,
      wine_experience: null,
      birthday: null,
    },
    session: { user: { id: "user-1", email: "alex@example.com" } },
    refreshMember: jest.fn(),
  }),
}));

jest.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      signOut: jest.fn(),
      signInWithPassword: jest.fn(),
      updateUser: jest.fn(),
    },
    from: jest.fn(() => ({
      update: jest.fn(() => ({ eq: jest.fn() })),
    })),
  },
}));

describe("SettingsScreen", () => {
  beforeEach(() => {
    mockBillingState = {
      premiumActive: false,
      hostCreditBalance: 0,
      hasAdminBillingBypass: false,
      effectivePremiumActive: false,
      effectiveHostingAccess: false,
      billingAccessLabel: null,
      nativePurchasesAvailable: false,
      unsupportedReason: "RevenueCat is not configured for this iOS build.",
      premiumDisplayName: "Premium Monthly",
      premiumDisplayPriceWithPeriod: "$4.99/month",
      hostCreditDisplayPrice: "$10.00",
      isLoading: false,
      isPurchasingPremium: false,
      isPurchasingHostCredit: false,
      isRestoringPurchases: false,
      purchasePremium: jest.fn(),
      purchaseHostCredit: jest.fn(),
      restorePurchases: jest.fn(),
    };
  });

  it("shows premium pricing and curated billing guidance in settings", () => {
    render(<SettingsScreen />);

    expect(screen.getByText("Premium Monthly · $4.99/month")).toBeTruthy();
    expect(
      screen.getByText(
        "Event participation stays free. Premium only gates the personal cellar experience. Purchases are unavailable in this build right now. Use a native preview, TestFlight, or App Store build with Apple billing enabled."
      )
    ).toBeTruthy();
    expect(screen.queryByText("RevenueCat is not configured for this iOS build.")).toBeNull();
    expect(screen.getByText("Preview Build Diagnostics")).toBeTruthy();
    expect(screen.getByText("update-123")).toBeTruthy();
    expect(screen.getByText("OTA update")).toBeTruthy();
  });
});
