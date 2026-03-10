jest.mock("@/lib/supabase", () => ({
  __esModule: true,
  supabase: {
    functions: {
      invoke: jest.fn(),
    },
    from: jest.fn(() => ({
      update: jest.fn(() => ({
        eq: jest.fn().mockResolvedValue({ error: null }),
      })),
    })),
  },
}));

import { generateEventImage, getEventImageErrorMessage } from "@/lib/event-image-generation";
import { supabase } from "@/lib/supabase";

describe("event-image-generation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("maps rate-limited responses to clean host-facing copy", async () => {
    (supabase.functions.invoke as jest.Mock).mockResolvedValue({
      data: {
        event_image_status: "failed",
        failure_reason: "rate_limited",
        error: "Gemini image gen error 429: RESOURCE_EXHAUSTED",
      },
      error: null,
    });

    const result = await generateEventImage("event-1", "Ides of March", "Theme", "Description");

    expect(result.ok).toBe(false);
    expect(result).toMatchObject({
      failure_reason: "rate_limited",
      error: "Hero image generation is temporarily unavailable. Try again in a few minutes.",
    });
  });

  it("normalizes raw 429 provider payloads even without a structured failure reason", () => {
    expect(
      getEventImageErrorMessage(
        "generation_failed",
        'Gemini image gen error 429: {"error":{"code":429,"status":"RESOURCE_EXHAUSTED"}}'
      )
    ).toBe("Hero image generation is temporarily unavailable. Try again in a few minutes.");
  });
});
