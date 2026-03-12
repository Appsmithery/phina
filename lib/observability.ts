import * as Sentry from "@sentry/react-native";
import PostHog from "posthog-react-native";
import Constants from "expo-constants";

import { getPostHogRuntimeConfig } from "@/lib/observability-config";

type ObservabilityProps = Record<string, string | number | boolean | null | undefined>;

let posthog: PostHog | null = null;
let posthogDebugEnabled = false;
let observabilityInitialized = false;
let missingPostHogConfigLogged = false;
let posthogCaptureInDev = false;

function getExtra() {
  return Constants.expoConfig?.extra ?? {};
}

function normalizeProps(props?: ObservabilityProps): Record<string, string | number | boolean | null> | undefined {
  if (!props) return undefined;

  const normalizedEntries = Object.entries(props).filter(([, value]) => value !== undefined);
  if (normalizedEntries.length === 0) return undefined;

  return Object.fromEntries(normalizedEntries) as Record<string, string | number | boolean | null>;
}

function logMissingPostHogConfig(message: string) {
  if (missingPostHogConfigLogged) return;
  missingPostHogConfigLogged = true;
  console.warn(`[observability] ${message}`);
}

export function initObservability() {
  if (observabilityInitialized) return;
  observabilityInitialized = true;

  const extra = getExtra();
  const sentryDsn: string | undefined = extra.sentryDsn;
  const posthogKey: string | undefined = extra.posthogKey;
  const posthogConfig = getPostHogRuntimeConfig(extra, __DEV__);
  posthogDebugEnabled = posthogConfig.debugEnabled;
  posthogCaptureInDev = posthogConfig.captureInDev;

  if (sentryDsn) {
    Sentry.init({
      dsn: sentryDsn,
      enabled: !__DEV__,
      debug: false,
    });
  }

  if (posthogKey) {
    posthog = new PostHog(posthogKey, {
      host: posthogConfig.host,
      disabled: posthogConfig.disabled,
      captureAppLifecycleEvents: true,
    });
  } else if (!__DEV__) {
    logMissingPostHogConfig("PostHog disabled because EXPO_PUBLIC_POSTHOG_KEY is missing.");
  }

  if (!posthogConfig.hasCustomHost && !__DEV__) {
    console.warn(`[observability] EXPO_PUBLIC_POSTHOG_HOST missing. Falling back to ${posthogConfig.host}.`);
  }

  if (__DEV__ && !posthogConfig.captureInDev) {
    console.info("[observability] PostHog is disabled in development. Set EXPO_PUBLIC_POSTHOG_CAPTURE_IN_DEV=true to test analytics locally.");
  }
}

export function identifyUser(userId: string) {
  try {
    Sentry.setUser({ id: userId });
  } catch {}
  try {
    posthog?.identify(userId);
  } catch {}
}

export function clearUser() {
  try {
    Sentry.setUser(null);
  } catch {}
  try {
    posthog?.reset();
  } catch {}
}

export function trackEvent(name: string, props?: ObservabilityProps) {
  try {
    posthog?.capture(name, normalizeProps(props));
  } catch {}
}

export function trackScreen(name: string, props?: ObservabilityProps) {
  try {
    posthog?.screen(name, normalizeProps(props));
  } catch {}
}

export function captureError(error: unknown, context?: Record<string, unknown>) {
  try {
    Sentry.captureException(error, context ? { extra: context } : undefined);
  } catch {}
}

export function getPostHogClient() {
  return posthog;
}

export function isPostHogDebugEnabled() {
  return posthogDebugEnabled;
}

export function isPostHogCapturingInDev() {
  return posthogCaptureInDev;
}

export function isFeatureEnabled(key: string) {
  try {
    return posthog?.isFeatureEnabled(key);
  } catch {
    return undefined;
  }
}

export function reloadFeatureFlags() {
  try {
    return posthog?.reloadFeatureFlagsAsync();
  } catch {
    return Promise.resolve(undefined);
  }
}

export { Sentry };
