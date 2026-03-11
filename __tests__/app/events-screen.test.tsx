import React from "react";
import { render, screen } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import EventsScreen from "@/app/(tabs)/index";

let mockMember: { id?: string; is_admin?: boolean } | null = null;
let mockBillingState = {
  hostCreditBalance: 0,
  hasAdminBillingBypass: false,
  billingAccessLabel: null as string | null,
};

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
    mutations: { retry: false },
  },
});

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}

jest.mock("@/lib/supabase-context", () => ({
  useSupabase: () => ({ member: mockMember }),
}));

jest.mock("expo-router", () => ({
  router: { push: jest.fn() },
}));

jest.mock("@/lib/supabase", () => ({
  supabase: {
    from: () => ({
      select: () => ({
        order: () => Promise.resolve({ data: [], error: null }),
      }),
    }),
  },
}));

jest.mock("@/hooks/use-billing", () => ({
  useBilling: () => mockBillingState,
}));

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

describe("EventsScreen", () => {
  beforeEach(() => {
    mockMember = null;
    mockBillingState = {
      hostCreditBalance: 0,
      hasAdminBillingBypass: false,
      billingAccessLabel: null,
    };
  });

  it("renders Host button", () => {
    render(
      <Wrapper>
        <EventsScreen />
      </Wrapper>
    );
    expect(screen.getByText("Host")).toBeTruthy();
  });

  it("shows empty state when no events", () => {
    render(
      <Wrapper>
        <EventsScreen />
      </Wrapper>
    );
    expect(screen.getByText(/No upcoming events/)).toBeTruthy();
  });

  it("shows admin override status for admin accounts", () => {
    mockMember = { id: "member-1", is_admin: true };
    mockBillingState = {
      hostCreditBalance: 0,
      hasAdminBillingBypass: true,
      billingAccessLabel: "Admin override",
    };

    render(
      <Wrapper>
        <EventsScreen />
      </Wrapper>
    );

    expect(screen.getByText("Admin override")).toBeTruthy();
  });
});
