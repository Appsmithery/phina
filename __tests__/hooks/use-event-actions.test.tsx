import { act, renderHook, waitFor } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { useEndEvent, useStartRatingRound } from "@/hooks/use-event-actions";
import { supabase } from "@/lib/supabase";
import * as observability from "@/lib/observability";
import * as alert from "@/lib/alert";

const mockTrackEvent = jest.fn();
const mockShowAlert = jest.fn();
const mockGetSession = jest.fn<
  Promise<{ data: { session: { access_token: string } | null } }>,
  []
>(() => Promise.resolve({
  data: { session: { access_token: "token-123" } },
}));
const mockInvoke = jest.fn<
  Promise<{ data: unknown; error: unknown; response?: Response }>,
  [string, { body: { event_id: string; wine_id: string; duration_minutes: number }; headers?: Record<string, string> }]
>(
  () => Promise.resolve({ data: { sent: 1, expo_recipients: 1, web_recipients: 0, expo_sent: 1, web_sent: 0, skipped_reason: null }, error: null })
);
const mockEq = jest.fn(() => Promise.resolve({ error: null }));
const mockUpdate = jest.fn(() => ({ eq: mockEq }));
const mockInsert = jest.fn(() => Promise.resolve({ error: null }));
const mockSingle = jest.fn(() => Promise.resolve({
  data: { default_rating_window_minutes: 10 },
  error: null,
}));
const mockSelect = jest.fn(() => ({ eq: jest.fn(() => ({ single: mockSingle })) }));
const mockFrom = jest.fn((table: string) => {
  if (table === "events") {
    return {
      select: mockSelect,
      update: mockUpdate,
    };
  }

  if (table === "rating_rounds") {
    return {
      insert: mockInsert,
      update: mockUpdate,
    };
  }

  return {
    update: mockUpdate,
  };
});

jest.mock("@/lib/supabase", () => ({
  supabase: {
    from: jest.fn(),
    auth: {
      getSession: jest.fn(),
    },
    functions: {
      invoke: jest.fn(),
    },
  },
}));

jest.mock("@/lib/observability", () => ({
  trackEvent: jest.fn(),
}));

jest.mock("@/lib/alert", () => ({
  showAlert: jest.fn(),
}));

describe("useEndEvent", () => {
  let consoleWarnSpy: jest.SpyInstance;
  let consoleLogSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    (supabase.from as jest.Mock).mockImplementation(mockFrom);
    (supabase.auth.getSession as jest.Mock).mockImplementation(mockGetSession);
    (supabase.functions.invoke as jest.Mock).mockImplementation(mockInvoke);
    (observability.trackEvent as jest.Mock).mockImplementation(mockTrackEvent);
    (alert.showAlert as jest.Mock).mockImplementation(mockShowAlert);
    mockSingle.mockClear();
    mockSelect.mockClear();
    consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    consoleLogSpy = jest.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleWarnSpy.mockRestore();
    consoleLogSpy.mockRestore();
  });

  function createWrapper() {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });

    return function Wrapper({ children }: { children: React.ReactNode }) {
      return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
    };
  }

  it("mutates successfully", async () => {
    const { result } = renderHook(() => useEndEvent("event-1"), { wrapper: createWrapper() });

    await act(async () => {
      await result.current.mutateAsync();
    });

    expect(mockUpdate).toHaveBeenCalledWith({ status: "ended" });
    expect(mockTrackEvent).toHaveBeenCalledWith("event_ended", expect.objectContaining({
      event_id: "event-1",
      source: "host_controls",
    }));
  });

  it("tracks rating round start and push success", async () => {
    const { result } = renderHook(() => useStartRatingRound("event-1", "wine-1", 5), { wrapper: createWrapper() });

    await act(async () => {
      await result.current.mutateAsync();
    });

    await waitFor(() => expect(mockInvoke).toHaveBeenCalledWith("send-rating-round-push", {
      body: { event_id: "event-1", wine_id: "wine-1", duration_minutes: 10 },
      headers: { Authorization: "Bearer token-123" },
    }));

    expect(mockInsert).toHaveBeenCalledWith({
      event_id: "event-1",
      wine_id: "wine-1",
      is_active: true,
      duration_minutes: 10,
    });

    expect(mockTrackEvent).toHaveBeenCalledWith("rating_round_started", expect.objectContaining({
      event_id: "event-1",
      wine_id: "wine-1",
      duration_minutes: 10,
      source: "host_controls",
      success: true,
    }));
    expect(mockTrackEvent).toHaveBeenCalledWith("rating_round_push_sent", expect.objectContaining({
      event_id: "event-1",
      wine_id: "wine-1",
      source: "host_controls",
      success: true,
      sent: 1,
      expo_recipients: 1,
      expo_sent: 1,
    }));
    expect(mockShowAlert).toHaveBeenCalledWith(
      "Round started",
      "Guests can rate this wine for the next 10 minutes."
    );
  });

  it("tracks missing-session push failure without invoking the function", async () => {
    mockGetSession.mockResolvedValueOnce({ data: { session: null } });

    const { result } = renderHook(() => useStartRatingRound("event-2", "wine-2", 5), { wrapper: createWrapper() });

    await act(async () => {
      await result.current.mutateAsync();
    });

    expect(mockInvoke).not.toHaveBeenCalled();
    expect(mockTrackEvent).toHaveBeenCalledWith("rating_round_push_failed", expect.objectContaining({
      event_id: "event-2",
      wine_id: "wine-2",
      error_code: "missing_session",
      success: false,
    }));
    expect(mockShowAlert).toHaveBeenCalledWith(
      "Push notifications",
      "Round started and will close automatically in 10 minutes, but we couldn't send push notifications. You can still share the link."
    );
  });

  it("tracks rating round push failure", async () => {
    mockInvoke.mockResolvedValueOnce({
      data: null,
      error: { name: "FunctionsHttpError", message: "Edge Function returned a non-2xx status code" },
      response: new Response(JSON.stringify({ error: "Unauthorized", error_code: "unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }),
    });

    const { result } = renderHook(() => useStartRatingRound("event-3", "wine-3", 5), { wrapper: createWrapper() });

    await act(async () => {
      await result.current.mutateAsync();
    });

    await waitFor(() => expect(mockTrackEvent).toHaveBeenCalledWith("rating_round_push_failed", expect.objectContaining({
      event_id: "event-3",
      wine_id: "wine-3",
      error_code: "unauthorized",
      error_message: "Unauthorized",
      success: false,
      http_status: 401,
    })));
    expect(mockShowAlert).toHaveBeenCalledWith(
      "Push notifications",
      "Round started and will close automatically in 10 minutes, but we couldn't send push notifications. You can still share the link."
    );
  });
});
