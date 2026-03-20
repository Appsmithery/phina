import { Platform } from "react-native";
import * as Updates from "expo-updates";

import { trackEvent } from "@/lib/observability";
import { getUpdateDiagnostics } from "@/lib/update-diagnostics";

export const STARTUP_UPDATE_TIMEOUT_MS = 8000;

export type StartupUpdateResult =
  | { status: "skipped"; reason: "unsupported_platform" | "unsupported_channel" | "updates_disabled" }
  | { status: "no_update" }
  | { status: "reloaded" }
  | { status: "timeout" }
  | { status: "error"; message: string };

function getStartupUpdateEventProps() {
  const diagnostics = getUpdateDiagnostics();

  return {
    platform: Platform.OS,
    update_channel: diagnostics.channel ?? null,
    runtime_version: diagnostics.runtimeVersion ?? null,
    update_id: diagnostics.updateId ?? null,
    embedded_launch: diagnostics.isEmbeddedLaunch,
  };
}

export function shouldBlockOnStartupUpdate(): boolean {
  if (Platform.OS === "web") {
    return false;
  }

  if (!Updates.isEnabled) {
    return false;
  }

  return Updates.channel === "preview" || Updates.channel === "development";
}

export async function runBlockingStartupUpdate(
  timeoutMs = STARTUP_UPDATE_TIMEOUT_MS,
): Promise<StartupUpdateResult> {
  if (Platform.OS === "web") {
    return { status: "skipped", reason: "unsupported_platform" };
  }

  if (!Updates.isEnabled) {
    return { status: "skipped", reason: "updates_disabled" };
  }

  if (!shouldBlockOnStartupUpdate()) {
    return { status: "skipped", reason: "unsupported_channel" };
  }

  const eventProps = getStartupUpdateEventProps();
  let timedOut = false;
  let timeoutHandle: ReturnType<typeof setTimeout> | null = null;

  trackEvent("startup_update_check_started", eventProps);

  const updatePromise = (async (): Promise<StartupUpdateResult> => {
    try {
      const update = await Updates.checkForUpdateAsync();

      if (timedOut) {
        return { status: "timeout" };
      }

      if (!update.isAvailable) {
        trackEvent("startup_update_not_available", eventProps);
        return { status: "no_update" };
      }

      trackEvent("startup_update_available", eventProps);
      await Updates.fetchUpdateAsync();

      if (timedOut) {
        return { status: "timeout" };
      }

      trackEvent("startup_update_fetched", eventProps);
      trackEvent("startup_update_reload_requested", eventProps);
      await Updates.reloadAsync();
      return { status: "reloaded" };
    } catch (error) {
      if (timedOut) {
        return { status: "timeout" };
      }

      const message = error instanceof Error ? error.message : String(error);
      trackEvent("startup_update_failed", {
        ...eventProps,
        error_message: message,
      });
      return { status: "error", message };
    }
  })();

  const timeoutPromise = new Promise<StartupUpdateResult>((resolve) => {
    timeoutHandle = setTimeout(() => {
      timedOut = true;
      trackEvent("startup_update_timed_out", {
        ...eventProps,
        timeout_ms: timeoutMs,
      });
      resolve({ status: "timeout" });
    }, timeoutMs);
  });

  const result = await Promise.race([updatePromise, timeoutPromise]);

  if (timeoutHandle) {
    clearTimeout(timeoutHandle);
  }

  return result;
}
