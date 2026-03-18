import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";

import AuthScreen from "@/app/(auth)/index";
import { supabase } from "@/lib/supabase";
import { showAlert } from "@/lib/alert";
import { navigateAfterAuth } from "@/lib/post-auth-navigate";

const mockSetSessionFromAuth = jest.fn();

let mockSession: { access_token: string } | null = null;
let mockSessionLoaded = false;

jest.mock("expo-router", () => ({
  router: { push: jest.fn(), replace: jest.fn() },
  useLocalSearchParams: () => ({}),
}));

jest.mock("@/lib/supabase-context", () => ({
  useSupabase: () => ({
    session: mockSession,
    sessionLoaded: mockSessionLoaded,
    setSessionFromAuth: mockSetSessionFromAuth,
  }),
}));

jest.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      signUp: jest.fn(),
      signInWithPassword: jest.fn(),
      resetPasswordForEmail: jest.fn(),
    },
  },
}));

jest.mock("@/lib/oauth-google", () => ({
  signInWithGoogle: jest.fn(() => Promise.resolve(null)),
}));

jest.mock("@/lib/oauth-apple", () => ({
  signInWithApple: jest.fn(() => Promise.resolve(null)),
  isAppleAuthAvailable: jest.fn(() => true),
}));

jest.mock("@/lib/theme", () => ({
  useTheme: () => ({
    background: "#F2EFE9",
    surface: "#fff",
    text: "#4A3B35",
    textSecondary: "#6B5B54",
    textMuted: "#9A8B82",
    border: "#E5DDD6",
    primary: "#B58271",
  }),
}));

jest.mock("@/lib/last-email", () => ({
  getLastUsedEmail: jest.fn(() => Promise.resolve(null)),
  setLastUsedEmail: jest.fn(() => Promise.resolve()),
}));

jest.mock("@/lib/alert", () => ({
  showAlert: jest.fn(),
}));

jest.mock("@/lib/post-auth-navigate", () => ({
  navigateAfterAuth: jest.fn(() => Promise.resolve()),
}));

describe("AuthScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSession = null;
    mockSessionLoaded = false;
  });

  it("renders the password-first auth screen without the social disclaimer", () => {
    render(<AuthScreen />);

    expect(screen.getByLabelText("Phína logo")).toBeTruthy();
    expect(screen.getByText("Welcome back")).toBeTruthy();
    expect(screen.getByText("Sign in with your email and password.")).toBeTruthy();
    expect(screen.getByPlaceholderText("you@example.com")).toBeTruthy();
    expect(screen.getByPlaceholderText("Password")).toBeTruthy();
    expect(screen.queryByPlaceholderText("Confirm password")).toBeNull();
    expect(screen.getByText("Forgot password?")).toBeTruthy();
    expect(screen.getByText("Continue with Google")).toBeTruthy();
    expect(screen.getByText("Sign in with Apple")).toBeTruthy();
    expect(screen.queryByText("Need an account? Create one")).toBeNull();
    expect(screen.queryByText("Already have an account? Sign in")).toBeNull();
    expect(
      screen.queryByText("Google and Apple sign-in still work for members who prefer a provider account.")
    ).toBeNull();
  });

  it("keeps the create-account state free of the old mode-switch button", () => {
    render(<AuthScreen />);

    fireEvent.press(screen.getByLabelText("Switch to create account"));

    expect(screen.getByText("Create your account")).toBeTruthy();
    expect(screen.queryByText("Need an account? Create one")).toBeNull();
    expect(screen.queryByText("Already have an account? Sign in")).toBeNull();
  });

  it("waits for committed session state before navigating after password sign-in", async () => {
    const session = { access_token: "token" };
    (supabase.auth.signInWithPassword as jest.Mock).mockResolvedValue({
      data: { session },
      error: null,
    });

    const view = render(<AuthScreen />);

    fireEvent.changeText(screen.getByPlaceholderText("you@example.com"), "alex@example.com");
    fireEvent.changeText(screen.getByPlaceholderText("Password"), "password123");
    fireEvent.press(screen.getByLabelText("Sign in"));

    await waitFor(() => {
      expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
        email: "alex@example.com",
        password: "password123",
      });
    });

    expect(mockSetSessionFromAuth).toHaveBeenCalledWith(session);
    expect(navigateAfterAuth).not.toHaveBeenCalled();

    mockSession = session;
    mockSessionLoaded = true;
    view.rerender(<AuthScreen />);

    await waitFor(() => {
      expect(navigateAfterAuth).toHaveBeenCalled();
    });
  });

  it("waits for committed session state before navigating after sign-up with immediate session", async () => {
    const session = { access_token: "token" };
    (supabase.auth.signUp as jest.Mock).mockResolvedValue({
      data: { session },
      error: null,
    });

    const view = render(<AuthScreen />);

    fireEvent.press(screen.getByLabelText("Switch to create account"));
    fireEvent.changeText(screen.getByPlaceholderText("you@example.com"), "alex@example.com");
    fireEvent.changeText(screen.getByPlaceholderText("Password"), "password123");
    fireEvent.changeText(screen.getByPlaceholderText("Confirm password"), "password123");
    fireEvent.press(screen.getByLabelText("Create account"));

    await waitFor(() => {
      expect(supabase.auth.signUp).toHaveBeenCalledWith({
        email: "alex@example.com",
        password: "password123",
      });
    });

    expect(mockSetSessionFromAuth).toHaveBeenCalledWith(session);
    expect(navigateAfterAuth).not.toHaveBeenCalled();

    mockSession = session;
    mockSessionLoaded = true;
    view.rerender(<AuthScreen />);

    await waitFor(() => {
      expect(navigateAfterAuth).toHaveBeenCalled();
    });
  });

  it("waits for committed session state before navigating after Google sign-in", async () => {
    const session = { access_token: "token" };
    const { signInWithGoogle } = require("@/lib/oauth-google") as {
      signInWithGoogle: jest.Mock;
    };
    signInWithGoogle.mockResolvedValue(session);

    const view = render(<AuthScreen />);

    fireEvent.press(screen.getByLabelText("Continue with Google"));

    await waitFor(() => {
      expect(mockSetSessionFromAuth).toHaveBeenCalledWith(session);
    });

    expect(navigateAfterAuth).not.toHaveBeenCalled();

    mockSession = session;
    mockSessionLoaded = true;
    view.rerender(<AuthScreen />);

    await waitFor(() => {
      expect(navigateAfterAuth).toHaveBeenCalled();
    });
  });

  it("tells duplicate-email sign-up attempts to sign in instead", async () => {
    (supabase.auth.signUp as jest.Mock).mockRejectedValue({
      message: "User already registered",
      code: "user_already_exists",
    });

    render(<AuthScreen />);

    fireEvent.press(screen.getByLabelText("Switch to create account"));
    fireEvent.changeText(screen.getByPlaceholderText("you@example.com"), "alex@example.com");
    fireEvent.changeText(screen.getByPlaceholderText("Password"), "password123");
    fireEvent.changeText(screen.getByPlaceholderText("Confirm password"), "password123");
    fireEvent.press(screen.getByLabelText("Create account"));

    await waitFor(() => {
      expect(showAlert).toHaveBeenCalledWith(
        "Create account failed",
        "An account with this email already exists. Sign in or reset your password."
      );
    });

    expect(
      screen.getByText("An account with this email already exists. Sign in or reset your password.")
    ).toBeTruthy();
  });

  it("sends a password reset email from the main auth screen", async () => {
    (supabase.auth.resetPasswordForEmail as jest.Mock).mockResolvedValue({
      error: null,
    });

    render(<AuthScreen />);

    fireEvent.changeText(screen.getByPlaceholderText("you@example.com"), "alex@example.com");
    fireEvent.press(screen.getByText("Forgot password?"));

    await waitFor(() => {
      expect(supabase.auth.resetPasswordForEmail).toHaveBeenCalledWith(
        "alex@example.com",
        expect.objectContaining({
          redirectTo: expect.stringContaining("set-password"),
        })
      );
    });

    expect(showAlert).toHaveBeenCalledWith(
      "Check your email",
      "We sent a password reset link. Open it to choose a new password.",
      [{ text: "OK" }]
    );
  });
});
