import React from "react";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { ProfileEmptyState } from "@/components/ProfileEmptyState";
import { colors } from "@/lib/theme";

jest.mock("@expo/vector-icons", () => {
  const React = require("react");
  const { Text } = require("react-native");
  const Icon = ({ name }: { name: string }) => React.createElement(Text, null, name);
  return { Ionicons: Icon };
});

describe("ProfileEmptyState", () => {
  it("renders copy and placeholder labels", () => {
    render(<ProfileEmptyState theme={colors} onCtaPress={jest.fn()} />);
    expect(screen.getByText("Your taste profile starts here.")).toBeTruthy();
    expect(screen.getByText("Body")).toBeTruthy();
    expect(screen.getByText("Dryness")).toBeTruthy();
    expect(screen.getByText("Palette")).toBeTruthy();
    expect(screen.getByText("Browse Events")).toBeTruthy();
  });

  it("calls the CTA handler", () => {
    const onCtaPress = jest.fn();
    render(<ProfileEmptyState theme={colors} onCtaPress={onCtaPress} />);
    fireEvent.press(screen.getByText("Browse Events"));
    expect(onCtaPress).toHaveBeenCalledTimes(1);
  });

  it("matches the snapshot", () => {
    const tree = render(<ProfileEmptyState theme={colors} onCtaPress={jest.fn()} />).toJSON();
    expect(tree).toMatchSnapshot();
  });
});
