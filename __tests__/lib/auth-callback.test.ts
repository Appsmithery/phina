jest.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      setSession: jest.fn(),
      exchangeCodeForSession: jest.fn(),
    },
  },
}));

import {
  NATIVE_MAGIC_LINK_NEXT_ROUTE,
  NATIVE_MAGIC_LINK_REDIRECT_URL,
  buildNativeMagicLinkHandoffUrl,
  createSessionFromUrl,
  getPostAuthRouteFromUrl,
} from "@/lib/auth-callback";
import { supabase } from "@/lib/supabase";

describe("auth callback helpers", () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
    expect(getPostAuthRouteFromUrl("phina://auth/callback?code=test-code&next=https://example.com")).toBeNull();
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
});
