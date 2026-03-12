export const DEFAULT_POSTHOG_HOST = "https://us.i.posthog.com";

type ExtraSource = Record<string, unknown>;

function isTrue(value: unknown): boolean {
  return value === true || value === "true";
}

export function getPostHogRuntimeConfig(extra: ExtraSource, isDev: boolean) {
  const configuredHost =
    typeof extra.posthogHost === "string" && extra.posthogHost.trim().length > 0
      ? extra.posthogHost.trim()
      : null;
  const debugEnabled = isTrue(extra.posthogDebug);
  const captureInDev = isTrue(extra.posthogCaptureInDev);

  return {
    host: configuredHost ?? DEFAULT_POSTHOG_HOST,
    debugEnabled,
    captureInDev,
    disabled: isDev && !captureInDev,
    hasCustomHost: configuredHost !== null,
  };
}
