import React from "react";
import { render, screen } from "@testing-library/react-native";

import SignInScreen from "@/app/(auth)/sign-in";

jest.mock("expo-router", () => {
  const React = require("react");
  const { Text } = require("react-native");

  return {
    useLocalSearchParams: () => ({ email: "alex@example.com" }),
    Redirect: ({ href }: { href: { pathname: string; params?: Record<string, string> } }) =>
      React.createElement(Text, null, JSON.stringify(href)),
  };
});

describe("SignInScreen", () => {
  it("redirects legacy sign-in routes back to the unified auth screen", () => {
    render(<SignInScreen />);

    expect(
      screen.getByText(
        JSON.stringify({
          pathname: "/(auth)",
          params: { email: "alex@example.com", mode: "sign-in" },
        })
      )
    ).toBeTruthy();
  });
});
