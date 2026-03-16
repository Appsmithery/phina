import React, { useState } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react-native";
import {
  RatingInfoModal,
  RATING_INFO_DEFINITIONS,
  RatingSectionHeader,
  type RatingInfoKey,
} from "@/components/rating/RatingInfoModal";
import { RatingVoteSelector } from "@/components/rating/RatingVoteSelector";

jest.mock("@expo/vector-icons", () => ({
  Ionicons: "Ionicons",
  MaterialCommunityIcons: "MaterialCommunityIcons",
}));

function RatingInfoHarness() {
  const [infoKey, setInfoKey] = useState<RatingInfoKey | null>(null);

  return (
    <>
      <RatingSectionHeader title="Body" infoKey="body" onOpenInfo={setInfoKey} marginBottom={12} />
      <RatingSectionHeader title="Dryness" infoKey="dryness" onOpenInfo={setInfoKey} marginBottom={12} />
      <RatingSectionHeader title="Confidence" infoKey="confidence" onOpenInfo={setInfoKey} marginBottom={12} />
      <RatingSectionHeader title="Tasting Notes" infoKey="tastingNotes" onOpenInfo={setInfoKey} marginBottom={12} />
      <RatingInfoModal infoKey={infoKey} visible={infoKey != null} onClose={() => setInfoKey(null)} />
    </>
  );
}

describe("rating UI", () => {
  it("opens each rating definition from the info icon and closes the popup", () => {
    render(<RatingInfoHarness />);

    const definitions: Array<[string, (typeof RATING_INFO_DEFINITIONS)[keyof typeof RATING_INFO_DEFINITIONS]]> = [
      ["Show Body definition", RATING_INFO_DEFINITIONS.body],
      ["Show Dryness definition", RATING_INFO_DEFINITIONS.dryness],
      ["Show Confidence definition", RATING_INFO_DEFINITIONS.confidence],
      ["Show Tasting Notes definition", RATING_INFO_DEFINITIONS.tastingNotes],
    ];

    for (const [label, definition] of definitions) {
      fireEvent.press(screen.getByLabelText(label));

      const modal = screen.getByTestId("rating-info-modal");
      expect(within(modal).getByText(definition.title)).toBeTruthy();
      expect(within(modal).getByText(definition.body)).toBeTruthy();

      fireEvent.press(within(modal).getByText("Done"));
      expect(screen.queryByTestId("rating-info-modal")).toBeNull();
    }
  });

  it("renders rating vote buttons with the new labels", () => {
    const onChange = jest.fn();

    render(<RatingVoteSelector value={null} onChange={onChange} />);

    expect(screen.getByText("Dislike")).toBeTruthy();
    expect(screen.getByText("Meh")).toBeTruthy();
    expect(screen.getByText("Like")).toBeTruthy();
  });
});
