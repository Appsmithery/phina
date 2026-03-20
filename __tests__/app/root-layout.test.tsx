import React from "react";
import { act, render, waitFor } from "@testing-library/react-native";
import { Linking } from "react-native";

let mockSessionLoaded = true;
const mockSetSessionFromAuth = jest.fn();
const mockUseFonts = jest.fn(() => [true, null]);
const mockShouldBlockOnStartupUpdate = jest.fn(() => false);
const mockRunBlockingStartupUpdate = jest.fn((_timeoutMs?: number) =>
  Promise.resolve({ status: "no_update" }),
);

jest.mock("posthog-react-native", () => ({
  PostHogProvider: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock("expo-splash-screen", () => ({
  preventAutoHideAsync: jest.fn(() => Promise.resolve()),
  hideAsync: jest.fn(() => Promise.resolve()),
}));

jest.mock("expo-notifications", () => ({
  __mock: {
    setNotificationHandler: jest.fn((_handler?: unknown) => undefined),
    setNotificationChannelAsync: jest.fn(
      (_channelId?: string, _config?: unknown) => Promise.resolve(),
    ),
    addNotificationResponseReceivedListener: jest.fn((_listener?: unknown) => ({
      remove: jest.fn(),
    })),
  },
  AndroidImportance: { MAX: 5 },
  setNotificationHandler(handler: unknown) {
    return this.__mock.setNotificationHandler(handler);
  },
  setNotificationChannelAsync(channelId: string, config: unknown) {
    return this.__mock.setNotificationChannelAsync(channelId, config);
  },
  addNotificationResponseReceivedListener(listener: unknown) {
    return this.__mock.addNotificationResponseReceivedListener(listener);
  },
}));

jest.mock("expo-font", () => ({
  useFonts: () => mockUseFonts(),
}));

jest.mock("expo-router", () => {
  const React = require("react");

  const Stack = ({ children }: { children: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children);
  Stack.Screen = () => null;

  return {
    Stack,
    router: {
      push: jest.fn(),
      replace: jest.fn(),
    },
    useGlobalSearchParams: () => ({}),
    usePathname: () => "/",
  };
});

jest.mock("@/lib/observability", () => ({
  initObservability: jest.fn(),
  captureError: jest.fn(),
  getPostHogClient: () => null,
  isPostHogDebugEnabled: () => false,
  Sentry: {
    lastEventId: () => "event-id",
    wrap: <T,>(component: T) => component,
  },
  trackScreen: jest.fn(),
}));

jest.mock("@/lib/supabase-context", () => ({
  SupabaseProvider: ({ children }: { children: React.ReactNode }) => children,
  useSupabase: () => ({
    sessionLoaded: mockSessionLoaded,
    setSessionFromAuth: mockSetSessionFromAuth,
  }),
}));

jest.mock("@/lib/auth-callback", () => ({
  createSessionFromUrl: jest.fn(),
  getPostAuthRouteFromUrl: jest.fn(),
  looksLikeAuthCallback: jest.fn(() => false),
}));

jest.mock("@/lib/post-auth-route", () => ({
  POST_AUTH_ROUTE: "/post-auth",
}));

jest.mock("@/lib/startup-update", () => ({
  STARTUP_UPDATE_TIMEOUT_MS: 8000,
  shouldBlockOnStartupUpdate: () => mockShouldBlockOnStartupUpdate(),
  runBlockingStartupUpdate: (timeoutMs?: number) =>
    mockRunBlockingStartupUpdate(timeoutMs),
}));

jest.mock("@expo-google-fonts/playfair-display", () => ({
  PlayfairDisplay_600SemiBold: "PlayfairDisplay_600SemiBold",
  PlayfairDisplay_700Bold: "PlayfairDisplay_700Bold",
  PlayfairDisplay_700Bold_Italic: "PlayfairDisplay_700Bold_Italic",
}));

jest.mock("@expo-google-fonts/montserrat", () => ({
  Montserrat_300Light: "Montserrat_300Light",
  Montserrat_400Regular: "Montserrat_400Regular",
  Montserrat_600SemiBold: "Montserrat_600SemiBold",
}));

import { SupabaseLayout } from "@/app/_layout";
import * as SplashScreen from "expo-splash-screen";
import * as Notifications from "expo-notifications";

function createDeferred<T>() {
  let resolve: ((value: T) => void) | null = null;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });

  return {
    promise,
    resolve: (value: T) => resolve?.(value),
  };
}

describe("SupabaseLayout startup update gating", () => {
  const mockHideAsync = SplashScreen.hideAsync as jest.Mock;
  const mockPreventAutoHideAsync = SplashScreen.preventAutoHideAsync as jest.Mock;
  const notificationMocks = (
    Notifications as typeof Notifications & {
      __mock: {
        setNotificationHandler: jest.Mock;
        setNotificationChannelAsync: jest.Mock;
        addNotificationResponseReceivedListener: jest.Mock;
      };
    }
  ).__mock;

  beforeEach(() => {
    jest.useFakeTimers();
    mockSessionLoaded = true;
    mockSetSessionFromAuth.mockReset();
    mockUseFonts.mockReset();
    mockUseFonts.mockReturnValue([true, null]);
    mockShouldBlockOnStartupUpdate.mockReset();
    mockShouldBlockOnStartupUpdate.mockReturnValue(false);
    mockRunBlockingStartupUpdate.mockReset();
    mockRunBlockingStartupUpdate.mockResolvedValue({ status: "no_update" });
    mockHideAsync.mockReset();
    mockPreventAutoHideAsync.mockClear();
    notificationMocks.setNotificationChannelAsync.mockReset();
    notificationMocks.setNotificationHandler.mockReset();
    notificationMocks.addNotificationResponseReceivedListener.mockReset();
    notificationMocks.addNotificationResponseReceivedListener.mockReturnValue({
      remove: jest.fn(),
    });

    jest.spyOn(Linking, "getInitialURL").mockResolvedValue(null);
    jest.spyOn(Linking, "addEventListener").mockReturnValue({
      remove: jest.fn(),
    } as unknown as ReturnType<typeof Linking.addEventListener>);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it("skips the blocking startup update gate outside preview or development", async () => {
    render(<SupabaseLayout />);

    await waitFor(() => {
      expect(mockHideAsync).toHaveBeenCalled();
    });

    expect(mockRunBlockingStartupUpdate).not.toHaveBeenCalled();
  });

  it("holds the splash until the preview startup update gate resolves", async () => {
    mockShouldBlockOnStartupUpdate.mockReturnValue(true);
    const deferred = createDeferred<{ status: "no_update" }>();
    mockRunBlockingStartupUpdate.mockReturnValue(deferred.promise);

    render(<SupabaseLayout />);

    await act(async () => {
      await Promise.resolve();
    });

    expect(mockHideAsync).not.toHaveBeenCalled();

    await act(async () => {
      deferred.resolve({ status: "no_update" });
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(mockHideAsync).toHaveBeenCalled();
    });
  });

  it("fails open after the preview startup timeout if the gate never resolves", async () => {
    mockShouldBlockOnStartupUpdate.mockReturnValue(true);
    mockRunBlockingStartupUpdate.mockReturnValue(new Promise(() => {}));

    render(<SupabaseLayout />);

    act(() => {
      jest.advanceTimersByTime(7999);
    });
    expect(mockHideAsync).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(1);
    });

    await waitFor(() => {
      expect(mockHideAsync).toHaveBeenCalled();
    });
  });
});
