import React from "react";
import { act, render, screen, waitFor } from "@testing-library/react-native";

import { PostAuthGate } from "@/components/PostAuthGate";

jest.useFakeTimers();

const mockGetSession = jest.fn();
const mockGetPendingJoinEventId = jest.fn((): Promise<string | null> => Promise.resolve(null));
const mockClearPendingJoinEventId = jest.fn((): Promise<void> => Promise.resolve());
const mockSetPendingJoinEventId = jest.fn((): Promise<void> => Promise.resolve());
const mockSetSessionFromAuth = jest.fn();
const mockTrackEvent = jest.fn();

let mockSession: { user?: { id: string } } | null = null;
let mockSessionLoaded = false;
let mockMember: { profile_complete?: boolean } | null = null;
let mockMemberLoaded = false;

jest.mock("expo-router", () => {
  const React = require("react");
  const { Text } = require("react-native");

  return {
    Redirect: ({ href }: { href: string }) => React.createElement(Text, null, `redirect:${href}`),
  };
});

jest.mock("@/lib/supabase-context", () => ({
  useSupabase: () => ({
    session: mockSession,
    sessionLoaded: mockSessionLoaded,
    member: mockMember,
    memberLoaded: mockMemberLoaded,
    setSessionFromAuth: mockSetSessionFromAuth,
  }),
}));

jest.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: (...args: unknown[]) => mockGetSession(...args),
    },
  },
}));

jest.mock("@/lib/pending-join", () => ({
  getPendingJoinEventId: () => mockGetPendingJoinEventId(),
  clearPendingJoinEventId: () => mockClearPendingJoinEventId(),
  setPendingJoinEventId: () => mockSetPendingJoinEventId(),
}));

jest.mock("@/lib/theme", () => ({
  useTheme: () => ({
    background: "#F2EFE9",
    textSecondary: "#6B5B54",
    primary: "#B58271",
  }),
}));

jest.mock("@/lib/observability", () => ({
  trackEvent: (...args: unknown[]) => mockTrackEvent(...args),
}));

jest.mock("@/lib/update-diagnostics", () => ({
  getUpdateDiagnostics: () => ({
    channel: "preview",
    runtimeVersion: "1.0.0",
    updateId: "update-123",
    isEmbeddedLaunch: false,
  }),
}));

describe("PostAuthGate", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSession = null;
    mockSessionLoaded = false;
    mockMember = null;
    mockMemberLoaded = false;
    mockGetPendingJoinEventId.mockResolvedValue(null);
  });

  afterEach(() => {
    jest.clearAllTimers();
  });

  it("routes unauthenticated users to auth immediately in root mode", async () => {
    mockSessionLoaded = true;
    mockMemberLoaded = true;

    render(<PostAuthGate source="index" />);

    await waitFor(() => {
      expect(screen.getByText("redirect:/(auth)")).toBeTruthy();
    });

    expect(mockGetSession).not.toHaveBeenCalled();
  });

  it("recovers a session in post-auth mode before redirecting", async () => {
    const recoveredSession = { user: { id: "user-1" } };
    mockSessionLoaded = true;
    mockMemberLoaded = true;
    mockGetSession.mockResolvedValueOnce({
      data: { session: recoveredSession },
    });

    const view = render(<PostAuthGate source="post-auth" />);

    expect(screen.queryByText("redirect:/(auth)")).toBeNull();

    await waitFor(() => {
      expect(mockSetSessionFromAuth).toHaveBeenCalledWith(recoveredSession);
    });

    mockSession = recoveredSession;
    mockMember = { profile_complete: true };
    view.rerender(<PostAuthGate source="post-auth" />);

    await waitFor(() => {
      expect(screen.getByText("redirect:/(tabs)")).toBeTruthy();
    });
  });

  it("falls back to auth in post-auth mode after recovery retries fail", async () => {
    mockSessionLoaded = true;
    mockMemberLoaded = true;
    mockGetSession.mockResolvedValue({
      data: { session: null },
    });

    render(<PostAuthGate source="post-auth" />);

    await waitFor(() => {
      expect(mockGetSession).toHaveBeenCalledTimes(1);
    });

    await act(async () => {
      jest.advanceTimersByTime(500);
    });

    await waitFor(() => {
      expect(mockGetSession).toHaveBeenCalledTimes(2);
    });

    await waitFor(() => {
      expect(screen.getByText("redirect:/(auth)")).toBeTruthy();
    });
  });

  it("routes recovered users with incomplete profiles to onboarding", async () => {
    const recoveredSession = { user: { id: "user-1" } };
    mockSessionLoaded = true;
    mockMemberLoaded = true;
    mockGetSession.mockResolvedValueOnce({
      data: { session: recoveredSession },
    });

    const view = render(<PostAuthGate source="post-auth" />);

    await waitFor(() => {
      expect(mockSetSessionFromAuth).toHaveBeenCalledWith(recoveredSession);
    });

    mockSession = recoveredSession;
    mockMember = { profile_complete: false };
    view.rerender(<PostAuthGate source="post-auth" />);

    await waitFor(() => {
      expect(screen.getByText("redirect:/onboarding")).toBeTruthy();
    });
  });

  it("routes recovered users with pending joins to the join screen", async () => {
    const recoveredSession = { user: { id: "user-1" } };
    mockSessionLoaded = true;
    mockMemberLoaded = true;
    mockGetSession.mockResolvedValueOnce({
      data: { session: recoveredSession },
    });
    mockGetPendingJoinEventId.mockResolvedValueOnce("event-123");

    const view = render(<PostAuthGate source="post-auth" />);

    await waitFor(() => {
      expect(mockSetSessionFromAuth).toHaveBeenCalledWith(recoveredSession);
    });

    mockSession = recoveredSession;
    mockMember = { profile_complete: true };
    view.rerender(<PostAuthGate source="post-auth" />);

    await waitFor(() => {
      expect(screen.getByText("redirect:/join/event-123")).toBeTruthy();
    });

    expect(mockClearPendingJoinEventId).toHaveBeenCalled();
  });
});
