import { Platform } from "react-native";
import * as Updates from "expo-updates";

import {
  STARTUP_UPDATE_TIMEOUT_MS,
  runBlockingStartupUpdate,
  shouldBlockOnStartupUpdate,
} from "@/lib/startup-update";

const mockTrackEvent = jest.fn();
const mockGetUpdateDiagnostics = jest.fn(() => ({
  channel: "preview",
  runtimeVersion: "1.0.0",
  updateId: "update-123",
  createdAt: "2026-03-19T00:00:00.000Z",
  isEmbeddedLaunch: true,
  isEnabled: true,
}));

jest.mock("expo-updates", () => ({
  channel: "preview",
  isEnabled: true,
  checkForUpdateAsync: jest.fn(),
  fetchUpdateAsync: jest.fn(),
  reloadAsync: jest.fn(),
}));

jest.mock("@/lib/observability", () => ({
  trackEvent: (...args: unknown[]) => mockTrackEvent(...args),
}));

jest.mock("@/lib/update-diagnostics", () => ({
  getUpdateDiagnostics: () => mockGetUpdateDiagnostics(),
}));

describe("startup update helpers", () => {
  const mockCheckForUpdateAsync = Updates.checkForUpdateAsync as jest.Mock;
  const mockFetchUpdateAsync = Updates.fetchUpdateAsync as jest.Mock;
  const mockReloadAsync = Updates.reloadAsync as jest.Mock;

  beforeEach(() => {
    jest.useFakeTimers();
    mockTrackEvent.mockReset();
    mockGetUpdateDiagnostics.mockClear();
    mockCheckForUpdateAsync.mockReset();
    mockFetchUpdateAsync.mockReset();
    mockReloadAsync.mockReset();

    Object.defineProperty(Platform, "OS", {
      configurable: true,
      get: () => "android",
    });

    (Updates as { channel: string | null; isEnabled: boolean }).channel = "preview";
    (Updates as { channel: string | null; isEnabled: boolean }).isEnabled = true;
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it("only blocks startup on native preview or development channels", () => {
    expect(shouldBlockOnStartupUpdate()).toBe(true);

    (Updates as { channel: string | null }).channel = "production";
    expect(shouldBlockOnStartupUpdate()).toBe(false);

    (Updates as { channel: string | null }).channel = "preview";
    Object.defineProperty(Platform, "OS", {
      configurable: true,
      get: () => "web",
    });
    expect(shouldBlockOnStartupUpdate()).toBe(false);
  });

  it("returns no_update when no startup OTA is available", async () => {
    mockCheckForUpdateAsync.mockResolvedValue({ isAvailable: false });

    await expect(runBlockingStartupUpdate()).resolves.toEqual({
      status: "no_update",
    });

    expect(mockFetchUpdateAsync).not.toHaveBeenCalled();
    expect(mockReloadAsync).not.toHaveBeenCalled();
    expect(mockTrackEvent).toHaveBeenCalledWith(
      "startup_update_not_available",
      expect.objectContaining({ update_channel: "preview" }),
    );
  });

  it("fetches and reloads when a startup OTA is available", async () => {
    mockCheckForUpdateAsync.mockResolvedValue({ isAvailable: true });
    mockFetchUpdateAsync.mockResolvedValue({});
    mockReloadAsync.mockResolvedValue(undefined);

    await expect(runBlockingStartupUpdate()).resolves.toEqual({
      status: "reloaded",
    });

    expect(mockFetchUpdateAsync).toHaveBeenCalledTimes(1);
    expect(mockReloadAsync).toHaveBeenCalledTimes(1);
    expect(mockTrackEvent).toHaveBeenCalledWith(
      "startup_update_reload_requested",
      expect.objectContaining({ runtime_version: "1.0.0" }),
    );
  });

  it("times out and skips reload when the update check takes too long", async () => {
    const deferred: {
      resolve?: (value: { isAvailable: boolean }) => void;
    } = {};
    mockCheckForUpdateAsync.mockReturnValue(
      new Promise<{ isAvailable: boolean }>((resolve) => {
        deferred.resolve = resolve;
      }),
    );

    const resultPromise = runBlockingStartupUpdate(STARTUP_UPDATE_TIMEOUT_MS);
    jest.advanceTimersByTime(STARTUP_UPDATE_TIMEOUT_MS);

    await expect(resultPromise).resolves.toEqual({ status: "timeout" });

    if (deferred.resolve) {
      deferred.resolve({ isAvailable: true });
    }
    await Promise.resolve();
    await Promise.resolve();

    expect(mockFetchUpdateAsync).not.toHaveBeenCalled();
    expect(mockReloadAsync).not.toHaveBeenCalled();
    expect(mockTrackEvent).toHaveBeenCalledWith(
      "startup_update_timed_out",
      expect.objectContaining({ timeout_ms: STARTUP_UPDATE_TIMEOUT_MS }),
    );
  });
});
