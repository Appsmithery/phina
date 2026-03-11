import React from "react";
import { fireEvent, render, screen } from "@testing-library/react-native";
import ProfileScreen from "@/app/(tabs)/profile";

const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockTrackEvent = jest.fn();
const mockInvalidateQueries = jest.fn();
const mockPurchasePremium = jest.fn();
const mockPurchaseHostCredit = jest.fn();
const mockRestorePurchases = jest.fn();
let mockMember: any = {
  id: "member-1",
  first_name: "Alex",
  last_name: "Torelli",
  phone: null,
  city: null,
  state: null,
  wine_experience: null,
  birthday: null,
  created_at: "2026-01-05T00:00:00.000Z",
  avatar_url: null,
  avatar_storage_path: null,
  avatar_source: null,
};

let mockQueryState: {
  ratings: { data: any[]; isLoading: boolean };
  events: { data: number; isLoading: boolean };
  favorites: { data: number; isLoading: boolean };
} = {
  ratings: { data: [], isLoading: false },
  events: { data: 0, isLoading: false },
  favorites: { data: 0, isLoading: false },
};
let mockBillingState = {
  premiumActive: false,
  hostCreditBalance: 0,
  isLoading: false,
  isPurchasingPremium: false,
  isPurchasingHostCredit: false,
  isRestoringPurchases: false,
  purchasePremium: mockPurchasePremium,
  purchaseHostCredit: mockPurchaseHostCredit,
  restorePurchases: mockRestorePurchases,
};

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

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
    member: mockMember,
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
    storage: {
      from: jest.fn(() => ({
        upload: jest.fn(),
        getPublicUrl: jest.fn(),
        remove: jest.fn(),
      })),
    },
  },
}));

jest.mock("expo-image-picker", () => ({
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
}));

jest.mock("@/lib/alert", () => ({
  showAlert: jest.fn(),
}));

jest.mock("@/hooks/use-billing", () => ({
  useBilling: () => mockBillingState,
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
    mockMember = {
      id: "member-1",
      first_name: "Alex",
      last_name: "Torelli",
      phone: null,
      city: null,
      state: null,
      wine_experience: null,
      birthday: null,
      created_at: "2026-01-05T00:00:00.000Z",
      avatar_url: null,
      avatar_storage_path: null,
      avatar_source: null,
    };
    mockQueryState = {
      ratings: { data: [], isLoading: false },
      events: { data: 0, isLoading: false },
      favorites: { data: 0, isLoading: false },
    };
    mockPush.mockReset();
    mockReplace.mockReset();
    mockTrackEvent.mockReset();
    mockInvalidateQueries.mockReset();
    mockPurchasePremium.mockReset();
    mockPurchaseHostCredit.mockReset();
    mockRestorePurchases.mockReset();
    mockBillingState = {
      premiumActive: false,
      hostCreditBalance: 0,
      isLoading: false,
      isPurchasingPremium: false,
      isPurchasingHostCredit: false,
      isRestoringPurchases: false,
      purchasePremium: mockPurchasePremium,
      purchaseHostCredit: mockPurchaseHostCredit,
      restorePurchases: mockRestorePurchases,
    };
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
    expect(screen.getByLabelText("Edit photo")).toBeTruthy();
    expect(screen.queryByText("Remove photo")).toBeNull();
    expect(screen.getByTestId("profile-avatar-fallback")).toBeTruthy();
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

  it("renders the uploaded avatar and edit control", () => {
    mockMember = {
      ...mockMember,
      avatar_url: "https://example.com/avatar.jpg",
      avatar_storage_path: "member-1/avatar.jpg",
      avatar_source: "upload",
    };

    render(<ProfileScreen />);

    expect(screen.getByTestId("profile-avatar-image")).toBeTruthy();
    expect(screen.getByLabelText("Edit photo")).toBeTruthy();
    expect(screen.queryByText("Remove photo")).toBeNull();
  });
});
