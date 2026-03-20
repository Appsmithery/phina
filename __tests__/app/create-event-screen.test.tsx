import React from "react";
import { fireEvent, render, waitFor } from "@testing-library/react-native";

import CreateEventScreen from "@/app/event/create";

const mockShowAlert = jest.fn();
const mockInvalidateQueries = jest.fn((_query?: unknown) => Promise.resolve());
const mockGetEventInviteDetails = jest.fn();

jest.mock("expo-router", () => ({
  Stack: {
    Screen: () => null,
  },
  router: {
    replace: jest.fn(),
  },
}));

jest.mock("@/lib/theme", () => ({
  useTheme: () => ({
    background: "#F2EFE9",
    surface: "#FFFFFF",
    text: "#4A3B35",
    textSecondary: "#6B5B54",
    textMuted: "#9A8B82",
    border: "#E5DDD6",
    primary: "#B58271",
  }),
}));

jest.mock("@/lib/alert", () => ({
  showAlert: (title: string, message: string, buttons?: unknown) =>
    mockShowAlert(title, message, buttons),
}));

jest.mock("@/lib/event-image-generation", () => ({
  generateEventImage: jest.fn(),
}));

jest.mock("@/lib/observability", () => ({
  trackEvent: jest.fn(),
}));

jest.mock("@/lib/event-invite", () => ({
  getEventInviteDetails: (...args: unknown[]) => mockGetEventInviteDetails(...args),
}));

jest.mock("@/lib/supabase-context", () => ({
  useSupabase: () => ({
    session: { user: { id: "member-1" } },
  }),
}));

jest.mock("@/hooks/use-billing", () => ({
  useBilling: () => ({
    hostCreditBalance: 1,
    hasAdminBillingBypass: false,
    effectiveHostingAccess: true,
    billingAccessLabel: null,
    nativePurchasesAvailable: true,
    unsupportedReason: null,
    hostCreditDisplayPrice: "$10",
    isLoading: false,
    isPurchasingHostCredit: false,
    isRestoringPurchases: false,
    purchaseHostCredit: jest.fn(),
    restorePurchases: jest.fn(),
  }),
}));

jest.mock("@/lib/supabase", () => ({
  supabase: {
    rpc: jest.fn(async () => ({ data: "event-123", error: null })),
  },
}));

jest.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({
    invalidateQueries: (query: unknown) => mockInvalidateQueries(query),
  }),
}));

jest.mock("expo-clipboard", () => ({
  setStringAsync: jest.fn(() => Promise.resolve()),
}));

jest.mock("@/components/BillingCard", () => ({
  BillingCard: () => null,
}));

jest.mock("@/components/EventForm", () => ({
  EventForm: ({
    onSubmit,
  }: {
    onSubmit: (values: {
      title: string;
      theme: string;
      description: string;
      webLink: string;
      date: string;
      startsAt: string;
      endsAt: string;
      timezone: string;
      defaultRatingWindowMinutes: 5 | 10 | 15;
      tastingMode: "single_blind" | "double_blind";
      heroImageUrl: string | null;
      heroImageStatus: string;
    }) => void;
  }) => {
    const React = require("react");
    const { Text, TouchableOpacity } = require("react-native");

    return React.createElement(
      TouchableOpacity,
      {
        onPress: () =>
          onSubmit({
            title: "Test Event",
            theme: "Dinner",
            description: "",
            webLink: "",
            date: "2026-03-19",
            startsAt: "2026-03-19T19:00:00.000Z",
            endsAt: "2026-03-19T21:00:00.000Z",
            timezone: "America/New_York",
            defaultRatingWindowMinutes: 5,
            tastingMode: "single_blind",
            heroImageUrl: null,
            heroImageStatus: "none",
          }),
      },
      React.createElement(Text, null, "Submit event"),
    );
  },
}));

describe("CreateEventScreen", () => {
  beforeEach(() => {
    mockShowAlert.mockReset();
    mockInvalidateQueries.mockReset();
    mockGetEventInviteDetails.mockReset();
  });

  it("shows preview-specific invite guidance when using the native preview scheme", async () => {
    mockGetEventInviteDetails.mockReturnValue({
      url: "phina://join/event-123",
      isPreviewNativeInvite: true,
    });

    const { getByText } = render(<CreateEventScreen />);

    fireEvent.press(getByText("Submit event"));

    await waitFor(() => {
      expect(mockShowAlert).toHaveBeenCalledWith(
        "Share event link",
        expect.stringContaining("preview testers"),
        expect.any(Array),
      );
    });
  });

  it("keeps public invite guidance for production links", async () => {
    mockGetEventInviteDetails.mockReturnValue({
      url: "https://phina.appsmithery.co/join/event-123",
      isPreviewNativeInvite: false,
    });

    const { getByText } = render(<CreateEventScreen />);

    fireEvent.press(getByText("Submit event"));

    await waitFor(() => {
      expect(mockShowAlert).toHaveBeenCalledWith(
        "Share event link",
        expect.stringContaining("event page or ticketing site"),
        expect.any(Array),
      );
    });
  });
});
