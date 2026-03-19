import { POST_AUTH_ROUTE, normalizeSafePostAuthRoute, resolvePostAuthDestination } from "@/lib/post-auth-route";

describe("post-auth route helpers", () => {
  it("normalizes the root alias to the dedicated post-auth route", () => {
    expect(normalizeSafePostAuthRoute("/")).toBe(POST_AUTH_ROUTE);
    expect(normalizeSafePostAuthRoute("/(tabs)")).toBe("/(tabs)");
    expect(normalizeSafePostAuthRoute("https://example.com")).toBeNull();
  });

  it("routes unauthenticated users to auth", () => {
    expect(
      resolvePostAuthDestination({
        session: null,
        member: null,
        pendingJoinId: null,
      })
    ).toBe("/(auth)");
  });

  it("routes incomplete profiles to onboarding", () => {
    expect(
      resolvePostAuthDestination({
        session: { user: { id: "user-1" } } as never,
        member: { profile_complete: false } as never,
        pendingJoinId: null,
      })
    ).toBe("/onboarding");
  });

  it("routes pending joins before tabs once the profile is complete", () => {
    expect(
      resolvePostAuthDestination({
        session: { user: { id: "user-1" } } as never,
        member: { profile_complete: true } as never,
        pendingJoinId: "event-123",
      })
    ).toBe("/join/event-123");
  });

  it("routes completed authenticated users to tabs", () => {
    expect(
      resolvePostAuthDestination({
        session: { user: { id: "user-1" } } as never,
        member: { profile_complete: true } as never,
        pendingJoinId: null,
      })
    ).toBe("/(tabs)");
  });
});
