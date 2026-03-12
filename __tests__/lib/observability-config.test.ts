import { DEFAULT_POSTHOG_HOST, getPostHogRuntimeConfig } from "@/lib/observability-config";

describe("observability-config", () => {
  it("disables PostHog in development when capture-in-dev is false", () => {
    expect(
      getPostHogRuntimeConfig(
        {
          posthogHost: "https://us.i.posthog.com",
          posthogDebug: false,
          posthogCaptureInDev: false,
        },
        true
      )
    ).toEqual({
      host: "https://us.i.posthog.com",
      debugEnabled: false,
      captureInDev: false,
      disabled: true,
      hasCustomHost: true,
    });
  });

  it("enables PostHog in development when capture-in-dev is true", () => {
    expect(
      getPostHogRuntimeConfig(
        {
          posthogHost: "https://us.i.posthog.com",
          posthogDebug: true,
          posthogCaptureInDev: true,
        },
        true
      )
    ).toEqual({
      host: "https://us.i.posthog.com",
      debugEnabled: true,
      captureInDev: true,
      disabled: false,
      hasCustomHost: true,
    });
  });

  it("falls back to the default host in production when none is provided", () => {
    expect(
      getPostHogRuntimeConfig(
        {
          posthogDebug: false,
          posthogCaptureInDev: false,
        },
        false
      )
    ).toEqual({
      host: DEFAULT_POSTHOG_HOST,
      debugEnabled: false,
      captureInDev: false,
      disabled: false,
      hasCustomHost: false,
    });
  });
});
