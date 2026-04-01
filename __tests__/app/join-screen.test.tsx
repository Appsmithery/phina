import React from "react";
import { Platform } from "react-native";
import { render, waitFor } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import JoinEventScreen from "@/app/join/[eventId]";

jest.useFakeTimers();

const mockReplace = jest.fn();
const mockSetPendingJoinEventId = jest.fn((eventId: string) => Promise.resolve(eventId));

jest.mock("expo-router", () => ({
  useLocalSearchParams: () => ({ eventId: "event-123" }),
  router: { replace: (...args: unknown[]) => mockReplace(...args) },
}));

jest.mock("@/lib/supabase-context", () => ({
  useSupabase: () => ({
    session: null,
    sessionLoaded: true,
    member: null,
    memberLoaded: true,
  }),
}));

jest.mock("@/lib/supabase", () => ({
  supabase: {
    from: jest.fn(),
  },
}));

jest.mock("@/lib/pending-join", () => ({
  setPendingJoinEventId: (eventId: string) => mockSetPendingJoinEventId(eventId),
}));

describe("JoinEventScreen", () => {
  const originalNavigator = global.navigator;
  const originalWindow = global.window;

  beforeEach(() => {
    Object.defineProperty(Platform, "OS", {
      configurable: true,
      get: () => "web",
    });

    Object.defineProperty(global, "navigator", {
      configurable: true,
      value: { userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)" },
    });

    Object.defineProperty(global, "window", {
      configurable: true,
      value: {
        location: { assign: jest.fn() },
        setTimeout,
        clearTimeout,
      },
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
    Object.defineProperty(global, "navigator", { configurable: true, value: originalNavigator });
    Object.defineProperty(global, "window", { configurable: true, value: originalWindow });
  });

  it("persists the pending join and routes mobile web invite traffic into auth", async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <JoinEventScreen />
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(mockSetPendingJoinEventId).toHaveBeenCalledWith("event-123");
      expect(mockReplace).toHaveBeenCalledWith("/(auth)");
    });

    expect(window.location.assign).not.toHaveBeenCalled();
  });
});
