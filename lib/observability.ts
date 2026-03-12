import * as Sentry from "@sentry/react-native";
import PostHog from "posthog-react-native";
import Constants from "expo-constants";

type ObservabilityProps = Record<string, string | number | boolean | null | undefined>;

const DEFAULT_POSTHOG_HOST = "https://us.i.posthog.com";

let posthog: PostHog | null = null;
let posthogDebugEnabled = false;
let observabilityInitialized = false;
let missingPostHogConfigLogged = false;

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
  const posthogHost: string | undefined = extra.posthogHost;
  posthogDebugEnabled = extra.posthogDebug === true || extra.posthogDebug === "true";

  if (sentryDsn) {
    Sentry.init({
      dsn: sentryDsn,
      enabled: !__DEV__,
      debug: false,
    });
  }

  if (posthogKey) {
    posthog = new PostHog(posthogKey, {
      host: posthogHost ?? DEFAULT_POSTHOG_HOST,
      disabled: __DEV__,
      captureAppLifecycleEvents: true,
    });
  } else if (!__DEV__) {
    logMissingPostHogConfig("PostHog disabled because EXPO_PUBLIC_POSTHOG_KEY is missing.");
  }

  if (!posthogHost && !__DEV__) {
    console.warn(`[observability] EXPO_PUBLIC_POSTHOG_HOST missing. Falling back to ${DEFAULT_POSTHOG_HOST}.`);
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
