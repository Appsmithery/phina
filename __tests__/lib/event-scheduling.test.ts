import { formatEventTime, formatEventTimeRange } from "@/lib/event-scheduling";

describe("event scheduling formatting", () => {
  it("formats event times in 12-hour time with AM/PM", () => {
    expect(
      formatEventTime("2026-03-19T19:00:00.000Z", "UTC"),
    ).toBe("07:00 PM");
  });

  it("formats event time ranges with spaced separators", () => {
    expect(
      formatEventTimeRange(
        "2026-03-19T19:00:00.000Z",
        "2026-03-19T21:30:00.000Z",
        "UTC",
      ),
    ).toBe("07:00 PM - 09:30 PM");
  });
});
