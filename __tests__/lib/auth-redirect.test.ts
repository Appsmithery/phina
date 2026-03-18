describe("auth redirect helpers", () => {
  afterEach(() => {
    jest.resetModules();
    delete process.env.EXPO_PUBLIC_APP_URL;
  });

  it("returns the web set-password route on web", () => {
    jest.isolateModules(() => {
      jest.doMock("react-native", () => ({
        Platform: { OS: "web" },
      }));

      const { getPasswordResetRedirectUrl, getRedirectUrl } = require("@/lib/auth-redirect");
      expect(getPasswordResetRedirectUrl()).toBe("https://phina.appsmithery.co/set-password");
      expect(getRedirectUrl()).toBe("https://phina.appsmithery.co/set-password");
    });
  });

  it("returns the native callback bridge URL for native builds", () => {
    jest.isolateModules(() => {
      jest.doMock("react-native", () => ({
        Platform: { OS: "android" },
      }));

      const { getPasswordResetRedirectUrl, getRedirectUrl } = require("@/lib/auth-redirect");
      expect(getPasswordResetRedirectUrl()).toBe(
        "https://phina.appsmithery.co/callback?nativeRedirect=phina%3A%2F%2Fauth%2Fcallback&next=%2F%28auth%29%2Fset-password"
      );
      expect(getRedirectUrl()).toBe(
        "https://phina.appsmithery.co/callback?nativeRedirect=phina%3A%2F%2Fauth%2Fcallback&next=%2F%28auth%29%2Fset-password"
      );
    });
  });

  it("returns the hosted callback route for email confirmation on web", () => {
    jest.isolateModules(() => {
      jest.doMock("react-native", () => ({
        Platform: { OS: "web" },
      }));

      const { getEmailConfirmationRedirectUrl } = require("@/lib/auth-redirect");
      expect(getEmailConfirmationRedirectUrl()).toBe("https://phina.appsmithery.co/callback");
    });
  });

  it("returns the native callback bridge URL for email confirmation on native builds", () => {
    jest.isolateModules(() => {
      jest.doMock("react-native", () => ({
        Platform: { OS: "ios" },
      }));

      const { getEmailConfirmationRedirectUrl } = require("@/lib/auth-redirect");
      expect(getEmailConfirmationRedirectUrl()).toBe(
        "https://phina.appsmithery.co/callback?nativeRedirect=phina%3A%2F%2Fauth%2Fcallback&next=%2F"
      );
    });
  });
});
