import React from "react";
import { fireEvent, render, screen } from "@testing-library/react-native";
import ProfileScreen from "@/app/(tabs)/profile";

const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockTrackEvent = jest.fn();
const mockInvalidateQueries = jest.fn();

let mockQueryState: {
  ratings: { data: any[]; isLoading: boolean };
  events: { data: number; isLoading: boolean };
  favorites: { data: number; isLoading: boolean };
} = {
  ratings: { data: [], isLoading: false },
  events: { data: 0, isLoading: false },
  favorites: { data: 0, isLoading: false },
};

jest.mock("expo-linear-gradient", () => ({
  LinearGradient: "LinearGradient",
}));

jest.mock("@expo/vector-icons", () => {
  const React = require("react");
  const { Text } = require("react-native");
  const Icon = ({ name }: { name: string }) => React.createElement(Text, null, name);
  return { Ionicons: Icon };
});

jest.mock("expo-router", () => ({
  router: {
    push: (...args: unknown[]) => mockPush(...args),
    replace: (...args: unknown[]) => mockReplace(...args),
  },
  useFocusEffect: (callback: () => void) => callback(),
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
    session: { user: { id: "member-1", email: "alex@example.com" } },
    refreshMember: jest.fn(),
  }),
}));

jest.mock("@/lib/observability", () => ({
  trackEvent: (...args: unknown[]) => mockTrackEvent(...args),
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

jest.mock("@tanstack/react-query", () => ({
  useQuery: jest.fn(({ queryKey }: { queryKey: string[] }) => {
    if (queryKey[1] === "ratings") return mockQueryState.ratings;
    if (queryKey[1] === "event_members") return mockQueryState.events;
    if (queryKey[1] === "favorites") return mockQueryState.favorites;
    return { data: undefined, isLoading: false };
  }),
  useQueryClient: () => ({
    invalidateQueries: mockInvalidateQueries,
  }),
}));

jest.mock("@/components/BirthdayPickerField", () => ({
  BirthdayPickerField: "BirthdayPickerField",
}));

describe("ProfileScreen", () => {
  beforeEach(() => {
    mockQueryState = {
      ratings: { data: [], isLoading: false },
      events: { data: 0, isLoading: false },
      favorites: { data: 0, isLoading: false },
    };
    mockPush.mockReset();
    mockReplace.mockReset();
    mockTrackEvent.mockReset();
    mockInvalidateQueries.mockReset();
  });

  it("hides the top section while ratings are loading", () => {
    mockQueryState.ratings = { data: [], isLoading: true };
    render(<ProfileScreen />);
    expect(screen.queryByText("Your taste profile starts here.")).toBeNull();
    expect(screen.queryByText("Your Taste Graph")).toBeNull();
  });

  it("shows the empty state until a user has rated a wine", () => {
    render(<ProfileScreen />);
    expect(screen.getByText("Your taste profile starts here.")).toBeTruthy();
    expect(screen.queryByText("Your Taste Graph")).toBeNull();
    expect(mockTrackEvent).toHaveBeenCalledWith("profile_empty_state_viewed");
  });

  it("navigates and tracks when the empty-state CTA is tapped", () => {
    render(<ProfileScreen />);
    fireEvent.press(screen.getByText("Browse Events"));
    expect(mockTrackEvent).toHaveBeenCalledWith("profile_empty_state_cta_tapped");
    expect(mockPush).toHaveBeenCalledWith("/(tabs)");
  });

  it("shows live stats and taste graph after a rating exists", () => {
    mockQueryState.ratings = {
      data: [{ value: 1, body: "medium", sweetness: "dry", tags: ["fruit"], wines: { color: "red" } }],
      isLoading: false,
    };
    render(<ProfileScreen />);
    expect(screen.getByText("Your Taste Graph")).toBeTruthy();
    expect(screen.queryByText("Your taste profile starts here.")).toBeNull();
  });

  it("shows live stats when only events exist", () => {
    mockQueryState.events = { data: 2, isLoading: false };
    mockQueryState.ratings = {
      data: [{ value: 0, body: null, sweetness: null, tags: [], wines: { color: null } }],
      isLoading: false,
    };
    render(<ProfileScreen />);
    expect(screen.getByText("Your Taste Graph")).toBeTruthy();
  });
});
