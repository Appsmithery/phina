import { Platform } from "react-native";

export const REVIEW_PROMPT_POLICY = {
  enabled: false,
  minSessions: 5,
  minDaysSinceSignup: 7,
  minPositiveMilestones: 3,
  cooldownDays: 120,
  supportedPlatforms: ["ios", "android"] as const,
  positiveMilestones: [
    "event_joined",
    "wine_rated",
    "rating_round_push_sent",
    "event_created",
  ] as const,
  blockedAfterNegativeFeedbackDays: 30,
};

export function canPlatformEverShowReviewPrompt() {
  return Platform.OS === "ios" || Platform.OS === "android";
}

export function shouldEnableReviewPromptNow() {
  return REVIEW_PROMPT_POLICY.enabled && canPlatformEverShowReviewPrompt();
}
