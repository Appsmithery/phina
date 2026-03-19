import * as Updates from "expo-updates";

export function getUpdateDiagnostics() {
  return {
    channel: Updates.channel,
    runtimeVersion: Updates.runtimeVersion,
    updateId: Updates.updateId,
    createdAt: Updates.createdAt?.toISOString() ?? null,
    isEmbeddedLaunch: Updates.isEmbeddedLaunch,
    isEnabled: Updates.isEnabled,
  };
}

export function shouldShowPreviewUpdateDiagnostics(): boolean {
  return Updates.channel === "preview";
}
