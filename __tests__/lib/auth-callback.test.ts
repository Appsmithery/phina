jest.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      setSession: jest.fn(),
      exchangeCodeForSession: jest.fn(),
      verifyOtp: jest.fn(),
      getSession: jest.fn(),
    },
  },
}));

import {
  NATIVE_MAGIC_LINK_NEXT_ROUTE,
  NATIVE_MAGIC_LINK_REDIRECT_URL,
  buildNativeMagicLinkHandoffUrl,
  createSessionFromUrl,
  getPostAuthRouteFromUrl,
  isAuthCallbackRoute,
  looksLikeAuthCallback,
  resolveSessionFromUrl,
} from "@/lib/auth-callback";
import { POST_AUTH_ROUTE } from "@/lib/post-auth-route";
import { supabase } from "@/lib/supabase";

describe("auth callback helpers", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (supabase.auth.getSession as jest.Mock).mockResolvedValue({
      data: { session: null },
      error: null,
    });
  });

  it("builds a native handoff URL for PKCE callbacks and preserves next route", () => {
    const currentUrl = new URL(
      `https://phina.appsmithery.co/callback?nativeRedirect=${encodeURIComponent(NATIVE_MAGIC_LINK_REDIRECT_URL)}&next=${encodeURIComponent(NATIVE_MAGIC_LINK_NEXT_ROUTE)}&code=test-code`
    );

    const handoffUrl = new URL(buildNativeMagicLinkHandoffUrl(currentUrl, NATIVE_MAGIC_LINK_REDIRECT_URL)!);
    expect(handoffUrl.toString()).toContain("phina://auth/callback");
    expect(handoffUrl.searchParams.get("code")).toBe("test-code");
    expect(handoffUrl.searchParams.get("next")).toBe(NATIVE_MAGIC_LINK_NEXT_ROUTE);
  });

  it("builds a native handoff URL for token callbacks and preserves next route", () => {
    const currentUrl = new URL(
      `https://phina.appsmithery.co/callback?nativeRedirect=${encodeURIComponent(NATIVE_MAGIC_LINK_REDIRECT_URL)}&next=${encodeURIComponent(NATIVE_MAGIC_LINK_NEXT_ROUTE)}#access_token=token&refresh_token=refresh`
    );

    const handoffUrl = new URL(buildNativeMagicLinkHandoffUrl(currentUrl, NATIVE_MAGIC_LINK_REDIRECT_URL)!);
    expect(handoffUrl.toString()).toContain("phina://auth/callback");
    expect(handoffUrl.searchParams.get("next")).toBe(NATIVE_MAGIC_LINK_NEXT_ROUTE);
    expect(handoffUrl.hash).toBe("#access_token=token&refresh_token=refresh");
  });

  it("builds a native handoff URL for confirmation callbacks that normalize the root route", () => {
    const currentUrl = new URL(
      `https://phina.appsmithery.co/callback?nativeRedirect=${encodeURIComponent(NATIVE_MAGIC_LINK_REDIRECT_URL)}&next=${encodeURIComponent("/")}&token_hash=token-hash&type=email`
    );

    const handoffUrl = new URL(buildNativeMagicLinkHandoffUrl(currentUrl, NATIVE_MAGIC_LINK_REDIRECT_URL)!);
    expect(handoffUrl.toString()).toContain("phina://auth/callback");
    expect(handoffUrl.searchParams.get("token_hash")).toBe("token-hash");
    expect(handoffUrl.searchParams.get("type")).toBe("email");
    expect(handoffUrl.searchParams.get("next")).toBe(POST_AUTH_ROUTE);
  });

  it("builds a native handoff URL without auth params so the app can resume from an existing session", () => {
    const currentUrl = new URL(
      `https://phina.appsmithery.co/callback?nativeRedirect=${encodeURIComponent(NATIVE_MAGIC_LINK_REDIRECT_URL)}&next=${encodeURIComponent(POST_AUTH_ROUTE)}`
    );

    const handoffUrl = new URL(buildNativeMagicLinkHandoffUrl(currentUrl, NATIVE_MAGIC_LINK_REDIRECT_URL)!);
    expect(handoffUrl.toString()).toContain("phina://auth/callback");
    expect(handoffUrl.searchParams.get("next")).toBe(POST_AUTH_ROUTE);
    expect(handoffUrl.searchParams.get("code")).toBeNull();
    expect(handoffUrl.searchParams.get("token_hash")).toBeNull();
    expect(handoffUrl.hash).toBe("");
  });

  it("rejects invalid native redirect targets", () => {
    const currentUrl = new URL("https://phina.appsmithery.co/callback?code=test-code");

    expect(buildNativeMagicLinkHandoffUrl(currentUrl, "exp://127.0.0.1/callback")).toBeNull();
  });

  it("extracts a safe post-auth route from native callback URLs", () => {
    expect(
      getPostAuthRouteFromUrl(
        `phina://auth/callback?code=test-code&next=${encodeURIComponent(NATIVE_MAGIC_LINK_NEXT_ROUTE)}`
      )
    ).toBe(NATIVE_MAGIC_LINK_NEXT_ROUTE);
    expect(getPostAuthRouteFromUrl("phina://auth/callback?code=test-code&next=%2F")).toBe(POST_AUTH_ROUTE);
    expect(getPostAuthRouteFromUrl("phina://auth/callback?code=test-code&next=https://example.com")).toBeNull();
  });

  it("recognizes auth callback routes with or without callback params", () => {
    expect(isAuthCallbackRoute("phina://auth/callback?next=%2Fpost-auth")).toBe(true);
    expect(isAuthCallbackRoute("https://phina.appsmithery.co/callback?next=%2Fpost-auth")).toBe(true);
    expect(isAuthCallbackRoute("phina://event/123")).toBe(false);
  });

  it("recognizes token-hash confirmation callbacks as auth callbacks", () => {
    expect(
      looksLikeAuthCallback("phina://auth/callback?token_hash=token-hash&type=email&next=%2F")
    ).toBe(true);
  });

  it("creates a session from token-based callback URLs", async () => {
    const session = { access_token: "token" };
    (supabase.auth.setSession as jest.Mock).mockResolvedValue({
      data: { session },
      error: null,
    });

    await expect(
      createSessionFromUrl("phina://auth/callback#access_token=token&refresh_token=refresh")
    ).resolves.toBe(session);

    expect(supabase.auth.setSession).toHaveBeenCalledWith({
      access_token: "token",
      refresh_token: "refresh",
    });
  });

  it("creates a session from PKCE callback URLs", async () => {
    const session = { access_token: "token" };
    (supabase.auth.exchangeCodeForSession as jest.Mock).mockResolvedValue({
      data: { session },
      error: null,
    });

    await expect(createSessionFromUrl("phina://auth/callback?code=test-code")).resolves.toBe(session);
    expect(supabase.auth.exchangeCodeForSession).toHaveBeenCalledWith("test-code");
  });

  it("verifies a session from token-hash confirmation callback URLs", async () => {
    const session = { access_token: "token" };
    (supabase.auth.verifyOtp as jest.Mock).mockResolvedValue({
      data: { session },
      error: null,
    });

    await expect(
      createSessionFromUrl("phina://auth/callback?token_hash=token-hash&type=email")
    ).resolves.toBe(session);

    expect(supabase.auth.verifyOtp).toHaveBeenCalledWith({
      token_hash: "token-hash",
      type: "email",
    });
  });

  it("falls back to the current session when the callback URL was already consumed", async () => {
    const existingSession = { access_token: "token" };
    (supabase.auth.exchangeCodeForSession as jest.Mock).mockResolvedValue({
      data: { session: null },
      error: new Error("Auth code already used"),
    });
    (supabase.auth.getSession as jest.Mock).mockResolvedValue({
      data: { session: existingSession },
      error: null,
    });

    await expect(resolveSessionFromUrl("phina://auth/callback?code=test-code")).resolves.toEqual({
      session: existingSession,
      outcome: "existing",
    });
  });

  it("reports missing when the callback route has no auth params and no session", async () => {
    await expect(
      resolveSessionFromUrl(`phina://auth/callback?next=${encodeURIComponent(POST_AUTH_ROUTE)}`)
    ).resolves.toEqual({
      session: null,
      outcome: "missing",
    });
  });
});
