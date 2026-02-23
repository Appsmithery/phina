import React from "react";
import { render, screen } from "@testing-library/react-native";
import AuthScreen from "@/app/(auth)/index";

jest.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      signUp: jest.fn(() =>
        Promise.resolve({ data: { session: null, user: null }, error: null })
      ),
      signInWithPassword: jest.fn(() =>
        Promise.resolve({ data: { session: null, user: null }, error: null })
      ),
    },
  },
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
  it("renders Phína logo and Sign Up / Sign In CTAs", () => {
    render(<AuthScreen />);
    expect(screen.getByLabelText("Phína logo")).toBeTruthy();
    expect(screen.getByText(/Create an account or sign in/)).toBeTruthy();
    expect(screen.getByText("Sign Up")).toBeTruthy();
    expect(screen.getByText("Sign In")).toBeTruthy();
  });

  it("has email and password inputs", () => {
    render(<AuthScreen />);
    expect(screen.getByPlaceholderText("you@example.com")).toBeTruthy();
    expect(screen.getByPlaceholderText("Password")).toBeTruthy();
    expect(screen.getByPlaceholderText("Confirm password")).toBeTruthy();
  });
});
