import React from "react";
import { render, screen } from "@testing-library/react-native";
import AuthScreen from "@/app/(auth)/index";

jest.mock("expo-router", () => ({
  router: { push: jest.fn() },
}));

jest.mock("@/lib/supabase-context", () => ({
  useSupabase: () => ({
    setSessionFromAuth: jest.fn(),
  }),
}));

jest.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      signInWithOtp: jest.fn(() => Promise.resolve({ error: null })),
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

describe("AuthScreen", () => {
  it("renders Phína logo, Send magic link button, Google sign-in, and sign in with password link", () => {
    render(<AuthScreen />);
    expect(screen.getByLabelText("Phína logo")).toBeTruthy();
    expect(screen.getByText("Enter your email to receive a secure sign-in magic link.")).toBeTruthy();
    expect(screen.getByText("Send magic link")).toBeTruthy();
    expect(screen.getByText("Continue with Google")).toBeTruthy();
    expect(screen.getByText("Sign in with Apple")).toBeTruthy();
    expect(screen.getByText("Sign in with password")).toBeTruthy();
  });

  it("has email input only", () => {
    render(<AuthScreen />);
    expect(screen.getByPlaceholderText("you@example.com")).toBeTruthy();
    expect(screen.queryByPlaceholderText("Password")).toBeNull();
    expect(screen.queryByPlaceholderText("Confirm password")).toBeNull();
  });
});
