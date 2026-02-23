import React from "react";
import { render, screen } from "@testing-library/react-native";
import AuthScreen from "@/app/(auth)/index";

jest.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      signInWithOtp: jest.fn(() => Promise.resolve({ error: null })),
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
  it("renders Phína title and magic link CTA", () => {
    render(<AuthScreen />);
    expect(screen.getByText("Phína")).toBeTruthy();
    expect(screen.getByText(/Enter your email/)).toBeTruthy();
    expect(screen.getByText("Send magic link")).toBeTruthy();
  });

  it("has email input", () => {
    render(<AuthScreen />);
    expect(screen.getByPlaceholderText("you@example.com")).toBeTruthy();
  });
});
