import * as Sentry from "@sentry/react-native";
import PostHog from "posthog-react-native";
import Constants from "expo-constants";

let posthog: PostHog | null = null;

export function initObservability() {
  const extra = Constants.expoConfig?.extra ?? {};
  const sentryDsn: string | undefined = extra.sentryDsn;
  const posthogKey: string | undefined = extra.posthogKey;
  const posthogHost: string | undefined = extra.posthogHost;

  if (sentryDsn) {
    Sentry.init({
      dsn: sentryDsn,
      enabled: true, // TEMP: smoke test — revert to !__DEV__ before commit
      debug: false,
    });
  }

  if (posthogKey && !__DEV__) {
    posthog = new PostHog(posthogKey, {
      host: posthogHost ?? "https://app.posthog.com",
    });
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

export function trackEvent(name: string, props?: Record<string, string | number | boolean | null>) {
  try {
    posthog?.capture(name, props);
  } catch {}
}

export function captureError(error: unknown, context?: Record<string, unknown>) {
  try {
    Sentry.captureException(error, context ? { extra: context } : undefined);
  } catch {}
}

export { Sentry };
