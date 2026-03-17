import * as Clipboard from "expo-clipboard";
import { Stack, router } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";

import { BillingCard } from "@/components/BillingCard";
import { EventForm, type EventFormValues } from "@/components/EventForm";
import { showAlert } from "@/lib/alert";
import { isNativePurchasesPlatform } from "@/lib/billing-config";
import { generateEventImage } from "@/lib/event-image-generation";
import {
  DEFAULT_RATING_WINDOW_MINUTES,
  formatEventDateLong,
  formatEventTimeRange,
} from "@/lib/event-scheduling";
import { useBilling } from "@/hooks/use-billing";
import { PAGE_HORIZONTAL_PADDING } from "@/lib/layout";
import { trackEvent } from "@/lib/observability";
import { supabase } from "@/lib/supabase";
import { useSupabase } from "@/lib/supabase-context";
import { useTheme } from "@/lib/theme";

const APP_BASE_URL =
  process.env.EXPO_PUBLIC_APP_URL ?? "https://phina.appsmithery.co";

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

  useEffect(() => {
    if (!session?.user?.id || billingLoading || effectiveHostingAccess) return;
    trackEvent("host_credit_paywall_viewed", {
      platform: Platform.OS,
      source: "event_create",
    });
  }, [billingLoading, effectiveHostingAccess, session?.user?.id]);

  const showSharePrompt = (
    eventId: string,
    values: Pick<
      EventFormValues,
      | "date"
      | "startsAt"
      | "endsAt"
      | "timezone"
      | "defaultRatingWindowMinutes"
    >,
  ) => {
    const joinUrl = `${APP_BASE_URL}/join/${eventId}`;
    const shareMessage = `I'm using Phina for our wine tasting on ${formatEventDateLong(values.startsAt, values.timezone)} from ${formatEventTimeRange(values.startsAt, values.endsAt, values.timezone)}. Rating rounds close automatically after ${values.defaultRatingWindowMinutes} minutes. Set up your account before the event so you're ready to rate: ${joinUrl}`;

    showAlert(
      "Share event link",
      `Post this in your event page or ticketing site so guests can set up before the tasting. This event will end automatically at ${formatEventTimeRange(values.startsAt, values.endsAt, values.timezone).split("-")[1]}.`,
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
                ? "Message copied to clipboard. Paste it into your event page or ticketing site."
                : "We could not copy the message automatically. You can still share your join link from the event page.",
            );
            router.replace(`/event/${eventId}`);
          },
        },
        {
          text: "Skip",
          style: "cancel",
          onPress: () => router.replace(`/event/${eventId}`),
        },
      ],
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
        p_starts_at: values.startsAt,
        p_ends_at: values.endsAt,
        p_timezone: values.timezone,
        p_default_rating_window_minutes: values.defaultRatingWindowMinutes,
        p_tasting_mode: values.tastingMode,
        p_description: values.description,
        p_web_link: values.webLink,
        p_event_image_url: values.heroImageUrl,
        p_event_image_status: values.heroImageStatus,
      });

      if (error) throw error;
      if (!data) throw new Error("Event was not created. Please try again.");

      if (!values.heroImageUrl) {
        void generateEventImage(
          data,
          values.title,
          values.theme,
          values.description,
        );
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["events"] }),
        queryClient.invalidateQueries({
          queryKey: ["profile", "event_members"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["billing", session.user.id],
        }),
      ]);
      trackEvent("event_created", {
        event_id: data,
        has_web_link: !!values.webLink,
        rating_window_minutes: values.defaultRatingWindowMinutes,
        platform: Platform.OS,
        source: "event_create",
      });

      showSharePrompt(data, values);
    } catch (error) {
      showAlert(
        "Error",
        error instanceof Error ? error.message : "Could not create event",
      );
    } finally {
      setIsCreating(false);
    }
  };

  const handlePurchaseHostCredit = async () => {
    try {
      await purchaseHostCredit();
      showAlert("Host credits updated", "You can now create your next event.");
    } catch (error) {
      showAlert(
        "Purchase failed",
        error instanceof Error ? error.message : "Could not start checkout.",
      );
    }
  };

  const handleRestorePurchases = async () => {
    try {
      await restorePurchases();
      showAlert(
        "Purchases restored",
        "Your Apple purchases have been refreshed.",
      );
    } catch (error) {
      showAlert(
        "Restore failed",
        error instanceof Error ? error.message : "Could not restore purchases.",
      );
    }
  };

  if (!session?.user?.id) {
    return (
      <View style={[styles.emptyState, { backgroundColor: theme.background }]}>
        <Stack.Screen options={{ title: "Host an Event" }} />
        <Text style={[styles.emptyTitle, { color: theme.text }]}>
          Host an event
        </Text>
        <Text style={[styles.emptyBody, { color: theme.textSecondary }]}>
          Sign in to create a paid hosted event.
        </Text>
      </View>
    );
  }

  if (billingLoading) {
    return (
      <View style={[styles.emptyState, { backgroundColor: theme.background }]}>
        <Stack.Screen options={{ title: "Host an Event" }} />
        <Text style={[styles.emptyTitle, { color: theme.text }]}>
          Checking host credits...
        </Text>
      </View>
    );
  }

  if (!effectiveHostingAccess) {
    const isNativeBilling = isNativePurchasesPlatform(Platform.OS);
    const hostCreditDetail =
      unsupportedReason && isNativeBilling && !nativePurchasesAvailable
        ? `Your credit is consumed only when the event is successfully created. ${unsupportedReason}`
        : "Your credit is consumed only when the event is successfully created.";

    return (
      <View
        style={[styles.paywallScreen, { backgroundColor: theme.background }]}
      >
        <Stack.Screen options={{ title: "Host an Event" }} />
        <Text style={[styles.paywallTitle, { color: theme.text }]}>
          Host your next tasting
        </Text>
        <Text style={[styles.paywallBody, { color: theme.textSecondary }]}>
          Hosting costs one $10 event credit. Event participation stays free for
          guests.
        </Text>
        <BillingCard
          icon="ticket-outline"
          title="1 Host Credit"
          description="Buy a single event credit and unlock the host flow immediately."
          badge="0 credits available"
          detail={hostCreditDetail}
          primaryLabel={
            isNativeBilling && !nativePurchasesAvailable
              ? "Use Native Build"
              : isPurchasingHostCredit
                ? "Opening purchase flow..."
                : isNativeBilling
                  ? "Buy for $10"
                  : "Checkout with Stripe"
          }
          onPrimaryPress={() => {
            void handlePurchaseHostCredit();
          }}
          primaryDisabled={
            isPurchasingHostCredit ||
            (isNativeBilling && !nativePurchasesAvailable)
          }
          secondaryLabel={
            isNativeBilling && nativePurchasesAvailable
              ? isRestoringPurchases
                ? "Restoring..."
                : "Restore"
              : undefined
          }
          onSecondaryPress={
            isNativeBilling && nativePurchasesAvailable
              ? () => {
                  void handleRestorePurchases();
                }
              : undefined
          }
          secondaryDisabled={
            isNativeBilling && nativePurchasesAvailable
              ? isRestoringPurchases
              : undefined
          }
        />
      </View>
    );
  }

  return (
    <View style={[styles.formScreen, { backgroundColor: theme.background }]}>
      <Stack.Screen options={{ title: "Host an Event" }} />
      <View
        style={[
          styles.creditBanner,
          { backgroundColor: theme.surface, borderColor: theme.border },
        ]}
      >
        <Text style={[styles.creditBannerTitle, { color: theme.text }]}>
          Ready to host
        </Text>
        <Text style={[styles.creditBannerBody, { color: theme.textSecondary }]}>
          {hasAdminBillingBypass
            ? (billingAccessLabel ?? "Admin override")
            : `${hostCreditBalance} host credit${hostCreditBalance === 1 ? "" : "s"} available`}
        </Text>
      </View>
      <EventForm
        heading="New event"
        showHeading={false}
        submitLabel="Create"
        memberId={session.user.id}
        initialValues={{
          title: "",
          theme: "",
          description: "",
          webLink: "",
          date: new Date().toISOString().slice(0, 10),
          startTime: "19:00",
          endTime: "21:00",
          ratingWindowMinutes: DEFAULT_RATING_WINDOW_MINUTES,
          tastingMode: "single_blind",
          heroImageUrl: null,
          heroImageStatus: "none",
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
    paddingHorizontal: PAGE_HORIZONTAL_PADDING,
  },
  creditBanner: {
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
    padding: PAGE_HORIZONTAL_PADDING,
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
