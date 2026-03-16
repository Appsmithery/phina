describe("getRedirectUrl", () => {
  afterEach(() => {
    jest.resetModules();
    delete process.env.EXPO_PUBLIC_APP_URL;
  });

  it("returns the web set-password route on web", () => {
    jest.isolateModules(() => {
      jest.doMock("react-native", () => ({
        Platform: { OS: "web" },
      }));

      const { getRedirectUrl } = require("@/lib/auth-redirect");
      expect(getRedirectUrl()).toBe("https://phina.appsmithery.co/set-password");
    });
  });

  it("returns the native callback bridge URL for native builds", () => {
    jest.isolateModules(() => {
      jest.doMock("react-native", () => ({
        Platform: { OS: "android" },
      }));

      const { getRedirectUrl } = require("@/lib/auth-redirect");
      expect(getRedirectUrl()).toBe(
        "https://phina.appsmithery.co/callback?nativeRedirect=phina%3A%2F%2Fauth%2Fcallback&next=%2F%28auth%29%2Fset-password"
      );
    });
  });
});
