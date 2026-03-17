import React from "react";
import { Platform, StyleSheet } from "react-native";
import { render, screen, waitFor } from "@testing-library/react-native";
import CellarScreen from "@/app/(tabs)/cellar";

const mockTrackEvent = jest.fn();
const mockUseQuery = jest.fn();

let mockBillingState = {
  effectivePremiumActive: false,
  nativePurchasesAvailable: false,
  unsupportedReason: "Native purchases are not available in Expo Go." as string | null,
  lastPremiumError: null as Error | null,
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
      effectivePremiumActive: false,
      nativePurchasesAvailable: false,
      unsupportedReason: "Native purchases are not available in Expo Go.",
      lastPremiumError: null,
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

  it("shows concise unavailable billing guidance, removes the premium badge, and tracks the unavailable state", async () => {
    render(<CellarScreen />);

    expect(screen.getByText("Billing unavailable")).toBeTruthy();
    expect(screen.queryByText("Cellar premium")).toBeNull();
    expect(
      screen.getByText(
        Platform.OS === "android"
          ? "Use a Play-installed internal or closed test build for billing validation."
          : "Open the native preview or development build instead of Expo Go to test purchases."
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

  it("surfaces the last premium error on the paywall and uses a light-fill manage button", () => {
    mockBillingState = {
      ...mockBillingState,
      nativePurchasesAvailable: true,
      unsupportedReason: null,
      lastPremiumError: new Error(
        "This Apple sandbox account may already own Premium. Try Restore or use a fresh sandbox tester."
      ),
    };

    mockUseQuery.mockReturnValue({
      data: [
        {
          id: "wine-1",
          event_id: "event-1",
          status: "stored",
          quantity: 1,
          producer: "Louis Latour",
          varietal: "Pinot Noir",
          vintage: 2022,
          region: "Bourgogne, Burgundy",
          drink_from: 2024,
          drink_until: 2028,
          display_photo_url: null,
          label_photo_url: null,
        },
      ],
      error: null,
      isError: false,
      isLoading: false,
      refetch: jest.fn(),
    });

    render(<CellarScreen />);

    expect(
      screen.getByText("This Apple sandbox account may already own Premium. Try Restore or use a fresh sandbox tester.")
    ).toBeTruthy();
    expect(screen.queryByText("Cellar premium")).toBeNull();

    const manageButton = screen.getByText("Manage").parent?.parent;
    const flattenedStyle = StyleSheet.flatten(manageButton?.props.style);

    expect(flattenedStyle).toEqual(
      expect.objectContaining({
        backgroundColor: "#B5827118",
        borderColor: "#B5827126",
      })
    );
  });
});
