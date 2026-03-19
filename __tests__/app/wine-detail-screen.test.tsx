import React from "react";
import { render, screen } from "@testing-library/react-native";
import PersonalWineDetailScreen from "@/app/wine/[wineId]/index";

const mockMutateAsync = jest.fn();
const mockInvalidateQueries = jest.fn();
let mockEffectivePremiumActive = false;
let mockWine: any = null;

jest.mock("expo-router", () => ({
  Stack: { Screen: () => null },
  router: {
    back: jest.fn(),
    canGoBack: () => true,
    push: jest.fn(),
    replace: jest.fn(),
  },
  useLocalSearchParams: () => ({ wineId: "wine-1" }),
}));

jest.mock("@expo/vector-icons", () => {
  const React = require("react");
  const { Text } = require("react-native");
  const Icon = ({ name }: { name: string }) => React.createElement(Text, null, name);
  return { Ionicons: Icon, MaterialCommunityIcons: Icon };
});

jest.mock("@/components/WineHeroImage", () => ({
  WineHeroImage: () => null,
}));

jest.mock("@/hooks/use-billing", () => ({
  useBilling: () => ({ effectivePremiumActive: mockEffectivePremiumActive }),
}));

jest.mock("@/hooks/use-remove-wine", () => ({
  useRemoveWine: () => ({
    mutateAsync: (...args: unknown[]) => mockMutateAsync(...args),
    isPending: false,
  }),
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
    thumbsUp: "#3F8F4E",
    thumbsDown: "#B55A5A",
    meh: "#C4956A",
  }),
}));

jest.mock("@/lib/supabase-context", () => ({
  useSupabase: () => ({
    session: { user: { id: "member-1" } },
    member: { id: "member-1" },
  }),
}));

jest.mock("@/lib/observability", () => ({
  trackEvent: jest.fn(),
}));

jest.mock("@/lib/alert", () => ({
  showAlert: jest.fn(),
}));

jest.mock("@/lib/supabase", () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn(() => ({ data: { id: "event-1", title: "Test Event", status: "active" }, error: null })),
        })),
      })),
    })),
  },
}));

jest.mock("@tanstack/react-query", () => ({
  useQuery: jest.fn(({ queryKey }: { queryKey: unknown[] }) => {
    if (queryKey[0] === "wine") return { data: mockWine, isLoading: false };
    if (queryKey[0] === "rating") return { data: null, isPending: false };
    if (queryKey[0] === "event") return { data: { id: "event-1", title: "Test Event", status: "active" } };
    return { data: null, isLoading: false, isPending: false };
  }),
  useQueryClient: () => ({
    invalidateQueries: (...args: unknown[]) => mockInvalidateQueries(...args),
  }),
}));

describe("PersonalWineDetailScreen", () => {
  beforeEach(() => {
    mockMutateAsync.mockReset();
    mockInvalidateQueries.mockReset();
    mockEffectivePremiumActive = false;
    mockWine = {
      id: "wine-1",
      event_id: "event-1",
      brought_by: "member-1",
      producer: "Louis Latour",
      varietal: "Pinot Noir",
      vintage: 2022,
      region: "Burgundy",
      display_photo_url: null,
      label_photo_url: null,
      image_generation_status: null,
      color: null,
      is_sparkling: false,
      quantity: 1,
      status: "storage",
      price_cents: null,
      price_range: null,
      drink_from: null,
      drink_until: null,
      wine_attributes: null,
      ai_summary: null,
      ai_geography: null,
      ai_production: null,
      ai_tasting_notes: null,
      ai_pairings: null,
    };
  });

  it("shows remove from event for event-origin wines", () => {
    render(<PersonalWineDetailScreen />);

    expect(screen.getByText("Remove from event")).toBeTruthy();
    expect(screen.getByText("Added to event")).toBeTruthy();
  });

  it("shows remove from cellar for cellar-origin wines when premium is active", () => {
    mockEffectivePremiumActive = true;
    mockWine = { ...mockWine, event_id: null };

    render(<PersonalWineDetailScreen />);

    expect(screen.getByText("Remove from cellar")).toBeTruthy();
    expect(screen.getByText("Added to cellar")).toBeTruthy();
  });

  it("hides cellar-only management when premium is inactive", () => {
    mockWine = { ...mockWine, event_id: null };

    render(<PersonalWineDetailScreen />);

    expect(screen.queryByText("Remove from cellar")).toBeNull();
    expect(screen.getByText("Premium required")).toBeTruthy();
    expect(
      screen.getByText("Start Premium to edit or remove wines that were added directly to your cellar."),
    ).toBeTruthy();
  });
});
