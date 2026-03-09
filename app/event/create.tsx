import * as Clipboard from "expo-clipboard";
import { router } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { EventForm, type EventFormValues } from "@/components/EventForm";
import { showAlert } from "@/lib/alert";
import { generateEventImage } from "@/lib/event-image-generation";
import { trackEvent } from "@/lib/observability";
import { supabase } from "@/lib/supabase";
import { useSupabase } from "@/lib/supabase-context";

function formatDisplayDate(dateString: string): string {
  return new Date(`${dateString}T00:00:00`).toLocaleDateString(undefined, {
    weekday: "short",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

const APP_BASE_URL = process.env.EXPO_PUBLIC_APP_URL ?? "https://phina.appsmithery.co";

export default function CreateEventScreen() {
  const { session } = useSupabase();
  const queryClient = useQueryClient();
  const [isCreating, setIsCreating] = useState(false);

  const showSharePrompt = (eventId: string, date: string) => {
    const joinUrl = `${APP_BASE_URL}/join/${eventId}`;
    const shareMessage = `I'm using Phina for our wine tasting on ${formatDisplayDate(date)}! Set up your account before the event so you're ready to rate: ${joinUrl}`;

    showAlert(
      "Share in Partiful",
      "Post this in your Partiful event so guests can set up before the tasting.",
      [
        {
          text: "Copy Message",
          onPress: async () => {
            let copied = false;

            try {
              await Clipboard.setStringAsync(shareMessage);
              copied = true;
            } catch (error) {
              if (typeof navigator !== "undefined" && navigator.clipboard) {
                await navigator.clipboard.writeText(shareMessage);
                copied = true;
              } else {
                console.warn("[create-event] clipboard copy failed:", error);
              }
            }

            showAlert(
              copied ? "Copied" : "Copy failed",
              copied
                ? "Message copied to clipboard. Paste it into your Partiful event."
                : "We could not copy the message automatically. You can still share your join link from the event page."
            );
            router.replace(`/event/${eventId}`);
          },
        },
        {
          text: "Skip",
          style: "cancel",
          onPress: () => router.replace(`/event/${eventId}`),
        },
      ]
    );
  };

  const create = async (values: EventFormValues) => {
    if (!session?.user?.id || !values.title) return;

    setIsCreating(true);
    try {
      const { data, error } = await supabase
        .from("events")
        .insert({
          title: values.title,
          theme: values.theme,
          date: values.date,
          status: "active",
          created_by: session.user.id,
          tasting_mode: values.tastingMode,
          description: values.description,
          partiful_url: values.partifulUrl,
          event_image_status: "pending",
        })
        .select("id")
        .single();

      if (error) throw error;

      const { error: memberError } = await supabase
        .from("event_members")
        .upsert(
          { event_id: data.id, member_id: session.user.id, checked_in: true },
          { onConflict: "event_id,member_id" }
        );

      if (memberError) {
        console.warn("[create-event] host auto-join failed:", memberError.message);
      }

      void generateEventImage(data.id, values.title, values.theme, values.description);

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["events"] }),
        queryClient.invalidateQueries({ queryKey: ["profile", "event_members"] }),
      ]);
      trackEvent("event_created", { event_id: data.id, has_partiful_url: !!values.partifulUrl });

      showSharePrompt(data.id, values.date);
    } catch (error) {
      showAlert("Error", error instanceof Error ? error.message : "Could not create event");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <EventForm
      heading="New event"
      submitLabel="Create"
      initialValues={{
        title: "",
        theme: "",
        description: "",
        partifulUrl: "",
        date: new Date().toISOString().slice(0, 10),
        tastingMode: "single_blind",
      }}
      isSubmitting={isCreating}
      minDate={new Date()}
      onSubmit={create}
    />
  );
}
