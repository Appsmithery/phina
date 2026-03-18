import React from "react";
import { render, screen } from "@testing-library/react-native";

import AddWineScreen from "@/app/add-wine";

let mockBillingState = {
  hasAdminBillingBypass: false,
  effectivePremiumActive: false,
  billingAccessLabel: null as string | null,
  nativePurchasesAvailable: false,
  unsupportedReason: "RevenueCat is not configured for this iOS build." as string | null,
  premiumDisplayName: "Premium Monthly",
  premiumDisplayPriceWithPeriod: "$4.99/month",
  isLoading: false,
  isPurchasingPremium: false,
  isRestoringPurchases: false,
  purchasePremium: jest.fn(),
  restorePurchases: jest.fn(),
};

jest.mock("expo-router", () => ({
  Stack: { Screen: () => null },
  router: { navigate: jest.fn(), push: jest.fn() },
}));

jest.mock("@expo/vector-icons", () => ({
  Ionicons: "Ionicons",
}));

jest.mock("@/hooks/use-billing", () => ({
  useBilling: () => mockBillingState,
}));

jest.mock("@/components/AddWineForm", () => ({
  AddWineForm: () => null,
}));

jest.mock("@/lib/billing", () => ({
  getUserFacingNativeBillingGuidance: jest.fn(
    () =>
      "Purchases are unavailable in this build right now. Use a native preview, TestFlight, or App Store build with Apple billing enabled."
  ),
}));

jest.mock("@/lib/supabase-context", () => ({
  useSupabase: () => ({
    sessionLoaded: true,
    session: { user: { id: "user-1" } },
    member: { id: "member-1" },
  }),
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

jest.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({
    invalidateQueries: jest.fn(),
  }),
}));

jest.mock("@/lib/observability", () => ({
  trackEvent: jest.fn(),
}));

describe("AddWineScreen", () => {
  beforeEach(() => {
    mockBillingState = {
      hasAdminBillingBypass: false,
      effectivePremiumActive: false,
      billingAccessLabel: null,
      nativePurchasesAvailable: false,
      unsupportedReason: "RevenueCat is not configured for this iOS build.",
      premiumDisplayName: "Premium Monthly",
      premiumDisplayPriceWithPeriod: "$4.99/month",
      isLoading: false,
      isPurchasingPremium: false,
      isRestoringPurchases: false,
      purchasePremium: jest.fn(),
      restorePurchases: jest.fn(),
    };
  });

  it("shows premium merchandising and curated unavailable billing guidance", () => {
    render(<AddWineScreen />);

    expect(screen.getByText("Premium Monthly · $4.99/month")).toBeTruthy();
    expect(
      screen.getByText(
        "Join and rate events for free, then upgrade when you want long-term collection tracking. Purchases are unavailable in this build right now. Use a native preview, TestFlight, or App Store build with Apple billing enabled."
      )
    ).toBeTruthy();
    expect(screen.queryByText("RevenueCat is not configured for this iOS build.")).toBeNull();
  });
});
