import React from "react";
import { render, screen } from "@testing-library/react-native";

import { BillingCard } from "@/components/BillingCard";

jest.mock("@expo/vector-icons", () => ({
  Ionicons: "Ionicons",
}));

jest.mock("@/lib/theme", () => ({
  useTheme: () => ({
    surface: "#fff",
    text: "#4A3B35",
    textSecondary: "#6B5B54",
    textMuted: "#9A8B82",
    border: "#E5DDD6",
    primary: "#B58271",
  }),
}));

describe("BillingCard", () => {
  it("applies button accessibility labels and roles", () => {
    render(
      <BillingCard
        icon="sparkles-outline"
        title="Premium Monthly · $4.99/month"
        description="Unlock your personal cellar."
        primaryLabel="Start Premium"
        primaryAccessibilityLabel="Start premium subscription"
        primaryAccessibilityHint="Premium renews at $4.99/month until canceled."
        onPrimaryPress={jest.fn()}
        secondaryLabel="Restore"
        secondaryAccessibilityLabel="Restore premium purchases"
        secondaryAccessibilityHint="Restore prior App Store purchases for this account."
        onSecondaryPress={jest.fn()}
      />
    );

    const primaryButton = screen.getByLabelText("Start premium subscription");
    const secondaryButton = screen.getByLabelText("Restore premium purchases");

    expect(primaryButton.props.accessibilityRole).toBe("button");
    expect(primaryButton.props.accessibilityHint).toBe(
      "Premium renews at $4.99/month until canceled."
    );
    expect(secondaryButton.props.accessibilityRole).toBe("button");
    expect(secondaryButton.props.accessibilityHint).toBe(
      "Restore prior App Store purchases for this account."
    );
  });
});
