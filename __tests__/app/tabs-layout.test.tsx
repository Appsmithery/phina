import React from "react";
import { render, screen } from "@testing-library/react-native";

import TabsLayout from "@/app/(tabs)/_layout";

let mockMember: { is_admin?: boolean } | null = null;

jest.mock("expo-router", () => {
  const React = require("react");
  const { Text } = require("react-native");

  const Tabs = ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, null, children);
  Tabs.Screen = ({ name }: { name: string }) => React.createElement(Text, null, name);

  return { Tabs };
});

jest.mock("@expo/vector-icons", () => ({
  Ionicons: ({ name }: { name: string }) => {
    const React = require("react");
    const { Text } = require("react-native");
    return React.createElement(Text, null, name);
  },
}));

jest.mock("@/lib/supabase-context", () => ({
  useSupabase: () => ({ member: mockMember }),
}));

jest.mock("@/lib/theme", () => ({
  useTheme: () => ({
    background: "#F2EFE9",
    surface: "#FFFFFF",
    text: "#4A3B35",
    textMuted: "#9A8B82",
    border: "#E5DDD6",
    primary: "#B58271",
  }),
}));

describe("TabsLayout", () => {
  it("renders four evenly visible tabs for non-admin users", () => {
    mockMember = { is_admin: false };

    render(<TabsLayout />);

    expect(screen.getByText("index")).toBeTruthy();
    expect(screen.getByText("cellar")).toBeTruthy();
    expect(screen.getByText("pick")).toBeTruthy();
    expect(screen.getByText("profile")).toBeTruthy();
    expect(screen.queryByText("admin")).toBeNull();
  });

  it("renders the admin tab only for admins", () => {
    mockMember = { is_admin: true };

    render(<TabsLayout />);

    expect(screen.getByText("admin")).toBeTruthy();
  });
});
