import Constants from "expo-constants";
import { Platform } from "react-native";
import { supabase } from "@/lib/supabase";
import type { Database, Json } from "@/types/database";

export const FEEDBACK_CATEGORIES = [
  { value: "bug", label: "Bug" },
  { value: "feature_request", label: "Feature request" },
  { value: "confusing", label: "Something confusing" },
  { value: "general_feedback", label: "General feedback" },
  { value: "praise", label: "Praise" },
  { value: "report_user_content", label: "Report user content" },
  { value: "report_ai_content", label: "Report AI content" },
] as const;

export const FEEDBACK_SENTIMENTS = [
  { value: "negative", label: "Needs work" },
  { value: "neutral", label: "Mixed" },
  { value: "positive", label: "Great" },
] as const;

export type FeedbackCategory = (typeof FEEDBACK_CATEGORIES)[number]["value"];
export type FeedbackSentiment = (typeof FEEDBACK_SENTIMENTS)[number]["value"];

export interface SubmitFeedbackInput {
  memberId: string;
  category: FeedbackCategory;
  message: string;
  sentiment: FeedbackSentiment | null;
  source: string;
  screen: string;
  wantsFollowUp: boolean;
  contextJson?: Json | null;
}

export async function submitFeedback(input: SubmitFeedbackInput) {
  const payload: Database["public"]["Tables"]["user_feedback"]["Insert"] = {
    member_id: input.memberId,
    category: input.category,
    message: input.message.trim(),
    sentiment: input.sentiment,
    source: input.source,
    screen: input.screen,
    context_json: input.contextJson ?? null,
    wants_follow_up: input.wantsFollowUp,
  };

  const { error } = await supabase.from("user_feedback").insert(payload);
  if (error) throw error;
}

export function buildFeedbackContext(base: {
  source: string;
  previousScreen: string;
  eventId?: string | null;
  wineId?: string | null;
  reportTarget?: string | null;
  reportTargetId?: string | null;
  reportedMemberId?: string | null;
}): Json {
  return {
    app_version: Constants.expoConfig?.version ?? null,
    platform: Platform.OS,
    source: base.source,
    previous_screen: base.previousScreen,
    event_id: base.eventId ?? null,
    wine_id: base.wineId ?? null,
    report_target: base.reportTarget ?? null,
    report_target_id: base.reportTargetId ?? null,
    reported_member_id: base.reportedMemberId ?? null,
  };
}
