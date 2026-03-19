import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";

import AuthScreen from "@/app/(auth)/index";
import { supabase } from "@/lib/supabase";
import { showAlert } from "@/lib/alert";
import { navigateAfterAuth } from "@/lib/post-auth-navigate";

const mockSetSessionFromAuth = jest.fn();
const mockGetSession = jest.fn();
let mockSession: unknown = null;
let mockSessionLoaded = true;

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
      resend: jest.fn(),
      signInWithPassword: jest.fn(),
      resetPasswordForEmail: jest.fn(),
      getSession: (...args: unknown[]) => mockGetSession(...args),
    },
  },
}));

jest.mock("@/lib/auth-redirect", () => ({
  getEmailConfirmationRedirectUrl: jest.fn(() => "https://phina.appsmithery.co/callback?nativeRedirect=phina%3A%2F%2Fauth%2Fcallback&next=%2Fpost-auth"),
  getPasswordResetRedirectUrl: jest.fn(() => "https://phina.appsmithery.co/callback?nativeRedirect=phina%3A%2F%2Fauth%2Fcallback&next=%2F%28auth%29%2Fset-password"),
  getRedirectUrl: jest.fn(() => "https://phina.appsmithery.co/callback?nativeRedirect=phina%3A%2F%2Fauth%2Fcallback&next=%2F%28auth%29%2Fset-password"),
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
    mockSessionLoaded = true;
    mockGetSession.mockResolvedValue({ data: { session: null } });
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
    expect(screen.getByText("Use at least 8 characters and confirm your password.")).toBeTruthy();
    expect(screen.getByLabelText("Create account").props.accessibilityState?.disabled).toBe(true);
    expect(screen.queryByText("Need an account? Create one")).toBeNull();
    expect(screen.queryByText("Already have an account? Sign in")).toBeNull();
  });

  it("shows visible sign-up validation for short passwords and keeps submit disabled", () => {
    render(<AuthScreen />);

    fireEvent.press(screen.getByLabelText("Switch to create account"));
    fireEvent.changeText(screen.getByPlaceholderText("you@example.com"), "alex@example.com");
    fireEvent.changeText(screen.getByPlaceholderText("Password"), "short");
    fireEvent.changeText(screen.getByPlaceholderText("Confirm password"), "short");

    expect(screen.getByText("Password must be at least 8 characters.")).toBeTruthy();
    expect(screen.getByLabelText("Create account").props.accessibilityState?.disabled).toBe(true);
  });

  it("shows visible sign-up validation for mismatched passwords and keeps submit disabled", () => {
    render(<AuthScreen />);

    fireEvent.press(screen.getByLabelText("Switch to create account"));
    fireEvent.changeText(screen.getByPlaceholderText("you@example.com"), "alex@example.com");
    fireEvent.changeText(screen.getByPlaceholderText("Password"), "password123");
    fireEvent.changeText(screen.getByPlaceholderText("Confirm password"), "password124");

    expect(screen.getByText("Passwords do not match.")).toBeTruthy();
    expect(screen.getByLabelText("Create account").props.accessibilityState?.disabled).toBe(true);
  });

  it("navigates directly after password sign-in", async () => {
    const session = { access_token: "token" };
    (supabase.auth.signInWithPassword as jest.Mock).mockResolvedValue({
      data: { session },
      error: null,
    });

    render(<AuthScreen />);

    fireEvent.changeText(screen.getByPlaceholderText("you@example.com"), "alex@example.com");
    fireEvent.changeText(screen.getByPlaceholderText("Password"), "password123");
    fireEvent.press(screen.getByLabelText("Sign in"));

    await waitFor(() => {
      expect(mockSetSessionFromAuth).toHaveBeenCalledWith(session);
      expect(navigateAfterAuth).toHaveBeenCalled();
    });
  });

  it("navigates directly after sign-up with an immediate session", async () => {
    const session = { access_token: "token" };
    (supabase.auth.signUp as jest.Mock).mockResolvedValue({
      data: { session },
      error: null,
    });

    render(<AuthScreen />);

    fireEvent.press(screen.getByLabelText("Switch to create account"));
    fireEvent.changeText(screen.getByPlaceholderText("you@example.com"), "alex@example.com");
    fireEvent.changeText(screen.getByPlaceholderText("Password"), "password123");
    fireEvent.changeText(screen.getByPlaceholderText("Confirm password"), "password123");
    expect(screen.getByLabelText("Create account").props.accessibilityState?.disabled).not.toBe(true);
    fireEvent.press(screen.getByLabelText("Create account"));

    await waitFor(() => {
      expect(mockSetSessionFromAuth).toHaveBeenCalledWith(session);
      expect(navigateAfterAuth).toHaveBeenCalled();
    });
  });

  it("navigates directly after Google sign-in", async () => {
    const session = { access_token: "token" };
    const { signInWithGoogle } = require("@/lib/oauth-google") as {
      signInWithGoogle: jest.Mock;
    };
    signInWithGoogle.mockResolvedValue(session);

    render(<AuthScreen />);

    fireEvent.press(screen.getByLabelText("Continue with Google"));

    await waitFor(() => {
      expect(mockSetSessionFromAuth).toHaveBeenCalledWith(session);
      expect(navigateAfterAuth).toHaveBeenCalled();
    });
  });

  it("navigates directly after Apple sign-in", async () => {
    const session = { access_token: "token" };
    const { signInWithApple } = require("@/lib/oauth-apple") as {
      signInWithApple: jest.Mock;
    };
    signInWithApple.mockResolvedValue(session);

    render(<AuthScreen />);

    fireEvent.press(screen.getByLabelText("Sign in with Apple"));

    await waitFor(() => {
      expect(mockSetSessionFromAuth).toHaveBeenCalledWith(session);
      expect(navigateAfterAuth).toHaveBeenCalled();
    });
  });

  it("shows Google sign-in errors from thrown exceptions", async () => {
    const { signInWithGoogle } = require("@/lib/oauth-google") as {
      signInWithGoogle: jest.Mock;
    };
    signInWithGoogle.mockRejectedValue(new Error("SDK unavailable"));

    render(<AuthScreen />);

    fireEvent.press(screen.getByLabelText("Continue with Google"));

    await waitFor(() => {
      expect(screen.getByText("SDK unavailable")).toBeTruthy();
    });

    expect(navigateAfterAuth).not.toHaveBeenCalled();
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

  it("shows confirmation-required UI after sign-up succeeds without an immediate session", async () => {
    (supabase.auth.signUp as jest.Mock).mockResolvedValue({
      data: { session: null },
      error: null,
    });

    render(<AuthScreen />);

    fireEvent.press(screen.getByLabelText("Switch to create account"));
    fireEvent.changeText(screen.getByPlaceholderText("you@example.com"), "alex@example.com");
    fireEvent.changeText(screen.getByPlaceholderText("Password"), "password123");
    fireEvent.changeText(screen.getByPlaceholderText("Confirm password"), "password123");
    fireEvent.press(screen.getByLabelText("Create account"));

    await waitFor(() => {
      expect(supabase.auth.signUp).toHaveBeenCalledWith({
        email: "alex@example.com",
        password: "password123",
        options: {
          emailRedirectTo: "https://phina.appsmithery.co/callback?nativeRedirect=phina%3A%2F%2Fauth%2Fcallback&next=%2Fpost-auth",
        },
      });
    });

    await waitFor(() => {
      expect(screen.getByText("Welcome back")).toBeTruthy();
      expect(screen.getByText("Check your email to confirm your account, then sign in with your password.")).toBeTruthy();
      expect(screen.getByText("Resend confirmation to alex@example.com")).toBeTruthy();
    }, { timeout: 2500 });
  });

  it("recovers a delayed session after sign-up and navigates without requiring a cold restart", async () => {
    const session = { access_token: "token", user: { id: "user-1" } };
    (supabase.auth.signUp as jest.Mock).mockResolvedValue({
      data: { session: null },
      error: null,
    });
    mockGetSession
      .mockResolvedValueOnce({ data: { session: null } })
      .mockResolvedValueOnce({ data: { session } });

    render(<AuthScreen />);

    fireEvent.press(screen.getByLabelText("Switch to create account"));
    fireEvent.changeText(screen.getByPlaceholderText("you@example.com"), "alex@example.com");
    fireEvent.changeText(screen.getByPlaceholderText("Password"), "password123");
    fireEvent.changeText(screen.getByPlaceholderText("Confirm password"), "password123");
    fireEvent.press(screen.getByLabelText("Create account"));

    await waitFor(() => {
      expect(mockSetSessionFromAuth).toHaveBeenCalledWith(session);
      expect(navigateAfterAuth).toHaveBeenCalled();
    });

    expect(screen.queryByText("Check your email to confirm your account, then sign in with your password.")).toBeNull();
  });

  it("resends confirmation with the same email redirect target", async () => {
    (supabase.auth.signUp as jest.Mock).mockResolvedValue({
      data: { session: null },
      error: null,
    });
    (supabase.auth.resend as jest.Mock).mockResolvedValue({
      data: {},
      error: null,
    });

    render(<AuthScreen />);

    fireEvent.press(screen.getByLabelText("Switch to create account"));
    fireEvent.changeText(screen.getByPlaceholderText("you@example.com"), "alex@example.com");
    fireEvent.changeText(screen.getByPlaceholderText("Password"), "password123");
    fireEvent.changeText(screen.getByPlaceholderText("Confirm password"), "password123");
    fireEvent.press(screen.getByLabelText("Create account"));

    await waitFor(() => {
      expect(screen.getByText("Resend confirmation to alex@example.com")).toBeTruthy();
    }, { timeout: 2500 });

    fireEvent.press(screen.getByLabelText("Resend confirmation email"));

    await waitFor(() => {
      expect(supabase.auth.resend).toHaveBeenCalledWith({
        type: "signup",
        email: "alex@example.com",
        options: {
          emailRedirectTo: "https://phina.appsmithery.co/callback?nativeRedirect=phina%3A%2F%2Fauth%2Fcallback&next=%2Fpost-auth",
        },
      });
    });
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
          redirectTo: "https://phina.appsmithery.co/callback?nativeRedirect=phina%3A%2F%2Fauth%2Fcallback&next=%2F%28auth%29%2Fset-password",
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
