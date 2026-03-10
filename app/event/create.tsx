import * as Clipboard from "expo-clipboard";
import { router } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Platform, Text, View, StyleSheet } from "react-native";

import { BillingCard } from "@/components/BillingCard";
import { EventForm, type EventFormValues } from "@/components/EventForm";
import { showAlert } from "@/lib/alert";
import { generateEventImage } from "@/lib/event-image-generation";
import { trackEvent } from "@/lib/observability";
import { supabase } from "@/lib/supabase";
import { useSupabase } from "@/lib/supabase-context";
import { useBilling } from "@/hooks/use-billing";
import { useTheme } from "@/lib/theme";

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
  const theme = useTheme();
  const queryClient = useQueryClient();
  const [isCreating, setIsCreating] = useState(false);
  const {
    hostCreditBalance,
    hasAdminBillingBypass,
    effectiveHostingAccess,
    billingAccessLabel,
    nativePurchasesAvailable,
    unsupportedReason,
    isLoading: billingLoading,
    isPurchasingHostCredit,
    isRestoringPurchases,
    purchaseHostCredit,
    restorePurchases,
  } = useBilling();

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
      const { data, error } = await supabase.rpc("create_hosted_event", {
        p_title: values.title,
        p_theme: values.theme,
        p_date: values.date,
        p_tasting_mode: values.tastingMode,
        p_description: values.description,
        p_partiful_url: values.partifulUrl,
      });

      if (error) throw error;
      if (!data) throw new Error("Event was not created. Please try again.");

      void generateEventImage(data, values.title, values.theme, values.description);

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["events"] }),
        queryClient.invalidateQueries({ queryKey: ["profile", "event_members"] }),
        queryClient.invalidateQueries({ queryKey: ["billing", session.user.id] }),
      ]);
      trackEvent("event_created", { event_id: data, has_partiful_url: !!values.partifulUrl });

      showSharePrompt(data, values.date);
    } catch (error) {
      showAlert("Error", error instanceof Error ? error.message : "Could not create event");
    } finally {
      setIsCreating(false);
    }
  };

  const handlePurchaseHostCredit = async () => {
    try {
      await purchaseHostCredit();
      showAlert("Host credits updated", "You can now create your next event.");
    } catch (error) {
      showAlert("Purchase failed", error instanceof Error ? error.message : "Could not start checkout.");
    }
  };

  const handleRestorePurchases = async () => {
    try {
      await restorePurchases();
      showAlert("Purchases restored", "Your Apple purchases have been refreshed.");
    } catch (error) {
      showAlert("Restore failed", error instanceof Error ? error.message : "Could not restore purchases.");
    }
  };

  if (!session?.user?.id) {
    return (
      <View style={[styles.emptyState, { backgroundColor: theme.background }]}>
        <Text style={[styles.emptyTitle, { color: theme.text }]}>Host an event</Text>
        <Text style={[styles.emptyBody, { color: theme.textSecondary }]}>
          Sign in to create a paid hosted event.
        </Text>
      </View>
    );
  }

  if (billingLoading) {
    return (
      <View style={[styles.emptyState, { backgroundColor: theme.background }]}>
        <Text style={[styles.emptyTitle, { color: theme.text }]}>Checking host credits...</Text>
      </View>
    );
  }

  if (!effectiveHostingAccess) {
    const hostCreditDetail =
      unsupportedReason && Platform.OS === "ios" && !nativePurchasesAvailable
        ? `Your credit is consumed only when the event is successfully created. ${unsupportedReason}`
        : "Your credit is consumed only when the event is successfully created.";
    return (
      <View style={[styles.paywallScreen, { backgroundColor: theme.background }]}>
        <Text style={[styles.paywallTitle, { color: theme.text }]}>Host your next tasting</Text>
        <Text style={[styles.paywallBody, { color: theme.textSecondary }]}>
          Hosting costs one $10 event credit. Event participation stays free for guests.
        </Text>
        <BillingCard
          icon="ticket-outline"
          title="1 Host Credit"
          description="Buy a single event credit and unlock the host flow immediately."
          badge="0 credits available"
          detail={hostCreditDetail}
          primaryLabel={Platform.OS === "ios" && !nativePurchasesAvailable ? "Use iOS Dev Build" : isPurchasingHostCredit ? "Opening checkout..." : Platform.OS === "ios" ? "Buy for $10" : "Checkout with Stripe"}
          onPrimaryPress={() => {
            void handlePurchaseHostCredit();
          }}
          primaryDisabled={isPurchasingHostCredit || (Platform.OS === "ios" && !nativePurchasesAvailable)}
          secondaryLabel={Platform.OS === "ios" && nativePurchasesAvailable ? (isRestoringPurchases ? "Restoring..." : "Restore") : undefined}
          onSecondaryPress={Platform.OS === "ios" && nativePurchasesAvailable ? () => {
            void handleRestorePurchases();
          } : undefined}
          secondaryDisabled={Platform.OS === "ios" && nativePurchasesAvailable ? isRestoringPurchases : undefined}
        />
      </View>
    );
  }

  return (
    <View style={[styles.formScreen, { backgroundColor: theme.background }]}>
      <View style={[styles.creditBanner, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <Text style={[styles.creditBannerTitle, { color: theme.text }]}>Ready to host</Text>
        <Text style={[styles.creditBannerBody, { color: theme.textSecondary }]}>
          {hasAdminBillingBypass
            ? billingAccessLabel ?? "Admin override"
            : `${hostCreditBalance} host credit${hostCreditBalance === 1 ? "" : "s"} available`}
        </Text>
      </View>
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
    </View>
  );
}

const styles = StyleSheet.create({
  formScreen: {
    flex: 1,
  },
  creditBanner: {
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: -4,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  creditBannerTitle: {
    fontSize: 14,
    fontFamily: "Montserrat_600SemiBold",
  },
  creditBannerBody: {
    marginTop: 4,
    fontSize: 13,
    fontFamily: "Montserrat_400Regular",
  },
  paywallScreen: {
    flex: 1,
    padding: 16,
    justifyContent: "center",
    gap: 16,
  },
  paywallTitle: {
    fontSize: 28,
    textAlign: "center",
    fontFamily: "PlayfairDisplay_700Bold",
  },
  paywallBody: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
    fontFamily: "Montserrat_400Regular",
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  emptyTitle: {
    fontSize: 24,
    textAlign: "center",
    fontFamily: "PlayfairDisplay_700Bold",
  },
  emptyBody: {
    marginTop: 8,
    fontSize: 14,
    textAlign: "center",
    fontFamily: "Montserrat_400Regular",
  },
});
