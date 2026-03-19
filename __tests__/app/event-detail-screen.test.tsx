import React from "react";
import { render } from "@testing-library/react-native";
import EventDetailScreen from "@/app/event/[id]/index";

const mockBack = jest.fn();
const mockReplace = jest.fn();
const mockCanGoBack = jest.fn(() => false);
const mockStackScreen = jest.fn((_props?: unknown) => null);
const mockInvalidateQueries = jest.fn();

jest.mock("expo-router", () => ({
  Stack: {
    Screen: (props: unknown) => {
      mockStackScreen(props);
      return null;
    },
  },
  router: {
    back: (...args: unknown[]) => mockBack(...args),
    replace: (...args: unknown[]) => mockReplace(...args),
    canGoBack: () => mockCanGoBack(),
    push: jest.fn(),
  },
  useLocalSearchParams: () => ({ id: "event-1" }),
}));

jest.mock("@expo/vector-icons", () => {
  const React = require("react");
  const { Text } = require("react-native");
  const Icon = ({ name }: { name: string }) => React.createElement(Text, null, name);
  return { Ionicons: Icon };
});

jest.mock("react-native-qrcode-svg", () => "QRCode");

jest.mock("@/components/EventHeroImage", () => ({
  EventHeroImage: () => null,
}));

jest.mock("@/components/WineThumbnailImage", () => ({
  WineThumbnailImage: () => null,
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
    secondary: "#C4956A",
  }),
}));

jest.mock("@/lib/alert", () => ({
  showAlert: jest.fn(),
}));

jest.mock("@/lib/observability", () => ({
  trackEvent: jest.fn(),
}));

jest.mock("@/lib/event-image-generation", () => ({
  generateEventImage: jest.fn(),
}));

jest.mock("@/hooks/use-event-actions", () => ({
  useEndEvent: () => ({ mutate: jest.fn(), isPending: false }),
  useStartRatingRound: () => ({ mutate: jest.fn(), isPending: false }),
  useEndRatingRound: () => ({ mutate: jest.fn(), isPending: false }),
}));

jest.mock("@/lib/supabase-context", () => ({
  useSupabase: () => ({
    member: { id: "member-1", is_admin: false },
    session: { user: { id: "member-1" } },
    sessionLoaded: true,
  }),
}));

jest.mock("@/lib/supabase", () => {
  const channel: { on: jest.Mock; subscribe: jest.Mock } = {
    on: jest.fn(),
    subscribe: jest.fn(),
  };
  channel.on.mockImplementation(() => channel);
  channel.subscribe.mockImplementation(() => channel);

  return {
    supabase: {
      channel: jest.fn(() => channel),
      removeChannel: jest.fn(),
    },
  };
});

jest.mock("@tanstack/react-query", () => ({
  useQuery: jest.fn(({ queryKey }: { queryKey: unknown[] }) => {
    switch (queryKey[0]) {
      case "event":
        return {
          data: {
            id: "event-1",
            title: "Test Event",
            theme: "Dinner",
            starts_at: "2026-02-23T00:00:00.000Z",
            ends_at: "2026-02-23T23:59:00.000Z",
            timezone: "America/New_York",
            status: "ended",
            tasting_mode: "single_blind",
            default_rating_window_minutes: 5,
            created_by: "member-1",
          },
          isLoading: false,
        };
      case "wines":
        return { data: [], isLoading: false };
      case "rating_rounds":
      case "event_rating_summary":
        return { data: [], isLoading: false };
      case "event_favorite":
        return { data: null, isLoading: false };
      case "event_members_count":
        return { data: 1, isLoading: false };
      default:
        return { data: null, isLoading: false };
    }
  }),
  useQueryClient: () => ({
    invalidateQueries: (...args: unknown[]) => mockInvalidateQueries(...args),
  }),
}));

describe("EventDetailScreen", () => {
  beforeEach(() => {
    mockBack.mockReset();
    mockReplace.mockReset();
    mockCanGoBack.mockReset();
    mockCanGoBack.mockReturnValue(false);
    mockStackScreen.mockClear();
    mockInvalidateQueries.mockReset();
  });

  it("falls back to the events tab when no back history exists", () => {
    render(<EventDetailScreen />);

    const screenConfig = mockStackScreen.mock.calls.at(-1)?.[0] as unknown as {
      options: { headerLeft: () => React.ReactElement };
    };

    const headerButton = screenConfig.options.headerLeft();
    (headerButton.props as { onPress: () => void }).onPress();

    expect(mockReplace).toHaveBeenCalledWith("/(tabs)");
    expect(mockBack).not.toHaveBeenCalled();
  });
});
