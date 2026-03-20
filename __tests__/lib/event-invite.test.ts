import { Platform } from "react-native";
import * as Updates from "expo-updates";

import { getEventInviteDetails } from "@/lib/event-invite";

jest.mock("expo-updates", () => ({
  channel: "preview",
}));

describe("getEventInviteDetails", () => {
  afterEach(() => {
    jest.restoreAllMocks();
    Object.defineProperty(Platform, "OS", {
      configurable: true,
      get: () => "ios",
    });
    (Updates as { channel: string | null }).channel = "preview";
  });

  it("uses the native preview scheme on native preview builds", () => {
    Object.defineProperty(Platform, "OS", {
      configurable: true,
      get: () => "android",
    });
    (Updates as { channel: string | null }).channel = "preview";

    expect(getEventInviteDetails("event-123")).toEqual({
      url: "phina://join/event-123",
      isPreviewNativeInvite: true,
    });
  });

  it("uses the public https invite on production builds", () => {
    Object.defineProperty(Platform, "OS", {
      configurable: true,
      get: () => "ios",
    });
    (Updates as { channel: string | null }).channel = "production";

    expect(getEventInviteDetails("event-123")).toEqual({
      url: "https://phina.appsmithery.co/join/event-123",
      isPreviewNativeInvite: false,
    });
  });

  it("keeps web invites public even on the preview channel", () => {
    Object.defineProperty(Platform, "OS", {
      configurable: true,
      get: () => "web",
    });
    (Updates as { channel: string | null }).channel = "preview";

    expect(getEventInviteDetails("event-123")).toEqual({
      url: "https://phina.appsmithery.co/join/event-123",
      isPreviewNativeInvite: false,
    });
  });
});
