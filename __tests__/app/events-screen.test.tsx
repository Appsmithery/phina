import React from "react";
import { render, screen } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import EventsScreen from "@/app/(tabs)/index";

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
  useSupabase: () => ({}),
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

describe("EventsScreen", () => {
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
    expect(screen.getByText(/No events yet/)).toBeTruthy();
  });
});
