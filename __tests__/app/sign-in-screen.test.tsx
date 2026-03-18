import React from "react";
import { render, screen } from "@testing-library/react-native";

import SignInScreen from "@/app/(auth)/sign-in";

jest.mock("expo-router", () => ({
  router: { replace: jest.fn() },
  useLocalSearchParams: () => ({ email: "alex@example.com" }),
}));

jest.mock("@expo/vector-icons", () => ({
  Ionicons: "Ionicons",
}));

jest.mock("@/lib/supabase-context", () => ({
  useSupabase: () => ({
    session: null,
    sessionLoaded: true,
    setSessionFromAuth: jest.fn(),
  }),
}));

jest.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      signInWithPassword: jest.fn(() => Promise.resolve({ data: { session: null }, error: null })),
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

jest.mock("@/lib/observability", () => ({
  trackEvent: jest.fn(),
}));

jest.mock("@/lib/last-email", () => ({
  setLastUsedEmail: jest.fn(),
}));

describe("SignInScreen", () => {
  it("shows Apple sign-in alongside Google sign-in on the password screen", () => {
    render(<SignInScreen />);

    expect(screen.getByText("Continue with Google")).toBeTruthy();
    expect(screen.getByText("Sign in with Apple")).toBeTruthy();
    expect(screen.getByPlaceholderText("Password")).toBeTruthy();
  });
});
