import React from "react";
import { render, screen, waitFor } from "@testing-library/react-native";

import CallbackScreen from "@/app/(auth)/callback";

const mockSetSessionFromAuth = jest.fn();
const mockRouterReplace = jest.fn();
const mockResolveSessionFromUrl = jest.fn<Promise<{ session: unknown; outcome: string }>, [string]>();
const mockBuildNativeMagicLinkHandoffUrl = jest.fn<string, [URL, string]>(() => "phina://auth/callback?next=%2Fpost-auth");
const mockLooksLikeAuthCallback = jest.fn<boolean, [string]>(() => false);
const mockGetPostAuthRouteFromUrl = jest.fn<string | null, [string]>(() => "/post-auth");

const globalAny = global as typeof global & { window?: any };

jest.mock("expo-router", () => ({
  router: {
    replace: (...args: unknown[]) => mockRouterReplace(...args),
  },
}));

jest.mock("@/lib/supabase-context", () => ({
  useSupabase: () => ({
    setSessionFromAuth: mockSetSessionFromAuth,
  }),
}));

jest.mock("@/lib/theme", () => ({
  useTheme: () => ({
    background: "#F2EFE9",
    text: "#4A3B35",
    textSecondary: "#6B5B54",
    primary: "#B58271",
  }),
}));

jest.mock("@/lib/auth-callback", () => ({
  buildNativeMagicLinkHandoffUrl: (currentUrl: URL, nativeRedirect: string) =>
    mockBuildNativeMagicLinkHandoffUrl(currentUrl, nativeRedirect),
  getPostAuthRouteFromUrl: (url: string) => mockGetPostAuthRouteFromUrl(url),
  looksLikeAuthCallback: (url: string) => mockLooksLikeAuthCallback(url),
  resolveSessionFromUrl: (url: string) => mockResolveSessionFromUrl(url),
}));

jest.mock("@/lib/observability", () => ({
  captureError: jest.fn(),
}));

describe("CallbackScreen", () => {
  const originalWindow = globalAny.window;

  beforeEach(() => {
    jest.clearAllMocks();
    mockResolveSessionFromUrl.mockResolvedValue({ session: null, outcome: "missing" });
    mockGetPostAuthRouteFromUrl.mockReturnValue("/post-auth");
    globalAny.window = {
      location: {
        href: "https://phina.appsmithery.co/callback",
        pathname: "/callback",
      },
      setTimeout,
      clearTimeout,
    };
  });

  afterAll(() => {
    globalAny.window = originalWindow;
  });

  it("shows a manual return-to-app state instead of an auth error when the native callback was already handled", async () => {
    globalAny.window.location.href =
      "https://phina.appsmithery.co/callback?nativeRedirect=phina%3A%2F%2Fauth%2Fcallback&next=%2Fpost-auth";
    mockLooksLikeAuthCallback.mockReturnValue(false);
    mockResolveSessionFromUrl.mockResolvedValue({
      session: null,
      outcome: "missing",
    });

    render(<CallbackScreen />);

    await waitFor(() => {
      expect(mockResolveSessionFromUrl).toHaveBeenCalled();
    });

    expect(screen.getByText("Return to the Phina app to finish sign in.")).toBeTruthy();
    expect(screen.getByText("Open app")).toBeTruthy();

    expect(screen.queryByText("Authentication Error")).toBeNull();
    expect(mockSetSessionFromAuth).not.toHaveBeenCalled();
  });

  it("navigates when the callback session already exists", async () => {
    const session = { access_token: "token" };
    globalAny.window.location.href = "https://phina.appsmithery.co/callback?code=test-code";
    mockResolveSessionFromUrl.mockResolvedValue({
      session,
      outcome: "existing",
    });

    render(<CallbackScreen />);

    await waitFor(() => {
      expect(mockSetSessionFromAuth).toHaveBeenCalledWith(session);
      expect(mockRouterReplace).toHaveBeenCalledWith("/post-auth");
    });

    expect(screen.queryByText("Authentication Error")).toBeNull();
  });
});
