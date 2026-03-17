import React from "react";
import { Platform } from "react-native";
import { render, screen, waitFor } from "@testing-library/react-native";
import CellarScreen from "@/app/(tabs)/cellar";

const mockTrackEvent = jest.fn();
const mockUseQuery = jest.fn();

let mockBillingState = {
  hasAdminBillingBypass: false,
  effectivePremiumActive: false,
  billingAccessLabel: null as string | null,
  nativePurchasesAvailable: false,
  unsupportedReason: "Native purchases are not available in Expo Go.",
  isLoading: false,
  isPurchasingPremium: false,
  isRestoringPurchases: false,
  purchasePremium: jest.fn(),
  restorePurchases: jest.fn(),
};

jest.mock("@tanstack/react-query", () => ({
  useQuery: (options: unknown) => mockUseQuery(options),
}));

jest.mock("expo-router", () => ({
  router: { push: jest.fn() },
  useLocalSearchParams: () => ({}),
}));

jest.mock("@expo/vector-icons", () => ({
  Ionicons: "Ionicons",
}));

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock("@react-navigation/bottom-tabs", () => ({
  useBottomTabBarHeight: () => 0,
}));

jest.mock("@/hooks/use-billing", () => ({
  useBilling: () => mockBillingState,
}));

jest.mock("@/lib/supabase", () => ({
  supabase: {},
}));

jest.mock("@/lib/supabase-context", () => ({
  useSupabase: () => ({
    session: { user: { id: "user-1" } },
    sessionLoaded: true,
    memberLoaded: true,
    member: { id: "member-1", profile_complete: true },
  }),
}));

jest.mock("@/lib/observability", () => ({
  trackEvent: (...args: unknown[]) => mockTrackEvent(...args),
  captureError: jest.fn(),
}));

describe("CellarScreen", () => {
  beforeEach(() => {
    mockUseQuery.mockReset();
    mockTrackEvent.mockReset();
    mockBillingState = {
      hasAdminBillingBypass: false,
      effectivePremiumActive: false,
      billingAccessLabel: null,
      nativePurchasesAvailable: false,
      unsupportedReason: "Native purchases are not available in Expo Go.",
      isLoading: false,
      isPurchasingPremium: false,
      isRestoringPurchases: false,
      purchasePremium: jest.fn(),
      restorePurchases: jest.fn(),
    };

    mockUseQuery.mockReturnValue({
      data: [],
      error: null,
      isError: false,
      isLoading: false,
      refetch: jest.fn(),
    });
  });

  it("shows unsupported billing detail and tracks the unavailable paywall state", async () => {
    render(<CellarScreen />);

    expect(screen.getByText("Billing unavailable")).toBeTruthy();
    expect(screen.getByText(/Native purchases are not available in Expo Go\./)).toBeTruthy();
    expect(
      screen.getByText(
        Platform.OS === "android"
          ? /Google Play internal or closed test build/
          : /native preview or development build/
      )
    ).toBeTruthy();

    await waitFor(() => {
      expect(mockTrackEvent).toHaveBeenCalledWith("premium_paywall_unavailable", {
        platform: Platform.OS,
        source: "cellar_tab",
        unsupported_reason: mockBillingState.unsupportedReason,
      });
    });
  });
});
