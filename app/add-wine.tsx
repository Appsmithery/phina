import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from "react-native";
import { useEffect } from "react";
import { Stack, router } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";

import { AddWineForm } from "@/components/AddWineForm";
import { BillingCard } from "@/components/BillingCard";
import { useBilling } from "@/hooks/use-billing";
import { showAlert } from "@/lib/alert";
import { getUserFacingNativeBillingGuidance } from "@/lib/billing";
import { PAGE_HORIZONTAL_PADDING } from "@/lib/layout";
import { trackEvent } from "@/lib/observability";
import { useSupabase } from "@/lib/supabase-context";
import { useTheme } from "@/lib/theme";

export default function AddWineScreen() {
  const { member, session, sessionLoaded } = useSupabase();
  const theme = useTheme();
  const queryClient = useQueryClient();
  const {
    hasAdminBillingBypass,
    effectivePremiumActive,
    billingAccessLabel,
    nativePurchasesAvailable,
    unsupportedReason,
    premiumDisplayName,
    premiumDisplayPriceWithPeriod,
    isLoading: billingLoading,
    isPurchasingPremium,
    isRestoringPurchases,
    purchasePremium,
    restorePurchases,
  } = useBilling();

  useEffect(() => {
    if (!member?.id || billingLoading || effectivePremiumActive) return;
    trackEvent("premium_paywall_viewed", { platform: Platform.OS, source: "add_wine" });
  }, [billingLoading, effectivePremiumActive, member?.id]);

  const onSuccess = async () => {
    await queryClient.invalidateQueries({ queryKey: ["cellar", "my-wines", member?.id] });
    trackEvent("wine_added_to_cellar", { platform: Platform.OS, source: "add_wine_form" });
    router.navigate("/(tabs)/cellar");
  };

  const onScan = () => {
    router.push({ pathname: "/scan-label", params: { returnTo: "/add-wine", scanMode: "prefill" } });
  };

  const handlePurchasePremium = async () => {
    try {
      await purchasePremium();
      showAlert("Membership updated", "Your premium cellar access is now active.");
    } catch (error) {
      showAlert("Checkout failed", error instanceof Error ? error.message : "Could not start checkout.");
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

  if (!sessionLoaded) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <Stack.Screen options={{ title: "Add to Cellar" }} />
        <Text style={[styles.placeholder, { color: theme.textSecondary }]}>Loading...</Text>
      </View>
    );
  }

  if (sessionLoaded && !session) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <Stack.Screen options={{ title: "Add to Cellar" }} />
        <Text style={[styles.placeholder, { color: theme.textSecondary }]}>Sign in to add a wine.</Text>
      </View>
    );
  }

  if (!member?.id) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <Stack.Screen options={{ title: "Add to Cellar" }} />
        <Text style={[styles.placeholder, { color: theme.textSecondary }]}>Sign in to add a wine.</Text>
      </View>
    );
  }

  if (billingLoading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <Stack.Screen options={{ title: "Add to Cellar" }} />
        <Text style={[styles.placeholder, { color: theme.textSecondary }]}>Checking your membership...</Text>
      </View>
    );
  }

  if (!effectivePremiumActive) {
    const premiumDetail =
      unsupportedReason && Platform.OS === "ios" && !nativePurchasesAvailable
        ? `Join and rate events for free, then upgrade when you want long-term collection tracking. ${getUserFacingNativeBillingGuidance(unsupportedReason)}`
        : "Join and rate events for free, then upgrade when you want long-term collection tracking.";
    const premiumMarketingTitle =
      premiumDisplayPriceWithPeriod
        ? `${premiumDisplayName ?? "Premium Monthly"} · ${premiumDisplayPriceWithPeriod}`
        : "Premium Monthly";

    return (
      <View style={[styles.container, styles.paywallContainer, { backgroundColor: theme.background }]}>
        <Stack.Screen options={{ title: "Add to Cellar" }} />
        <BillingCard
          icon="sparkles-outline"
          title={premiumMarketingTitle}
          description="Adding bottles to your personal cellar is part of the premium membership."
          badge={hasAdminBillingBypass ? (billingAccessLabel ?? "Admin override") : "Cellar premium"}
          detail={premiumDetail}
          primaryLabel={
            Platform.OS === "ios" && !nativePurchasesAvailable
              ? "Use iOS Dev Build"
              : isPurchasingPremium
                ? "Opening checkout..."
                : Platform.OS === "ios"
                  ? "Start Premium"
                  : "Subscribe with Stripe"
          }
          primaryAccessibilityLabel="Start premium subscription"
          primaryAccessibilityHint={
            premiumDisplayPriceWithPeriod
              ? `Premium renews at ${premiumDisplayPriceWithPeriod} until canceled.`
              : undefined
          }
          onPrimaryPress={() => {
            void handlePurchasePremium();
          }}
          primaryDisabled={isPurchasingPremium || (Platform.OS === "ios" && !nativePurchasesAvailable)}
          secondaryLabel={
            Platform.OS === "ios" && nativePurchasesAvailable
              ? (isRestoringPurchases ? "Restoring..." : "Restore")
              : undefined
          }
          onSecondaryPress={
            Platform.OS === "ios" && nativePurchasesAvailable
              ? () => {
                  void handleRestorePurchases();
                }
                : undefined
          }
          secondaryDisabled={Platform.OS === "ios" && nativePurchasesAvailable ? isRestoringPurchases : undefined}
          secondaryAccessibilityLabel={Platform.OS === "ios" && nativePurchasesAvailable ? "Restore premium purchases" : undefined}
        />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Stack.Screen options={{ title: "Add to Cellar" }} />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.keyboardView}>
        <AddWineForm eventId={null} memberId={member.id} onSuccess={onSuccess} onScan={onScan} />
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: PAGE_HORIZONTAL_PADDING },
  keyboardView: { flex: 1 },
  paywallContainer: { justifyContent: "center", gap: 16 },
  placeholder: { padding: 16, textAlign: "center", fontFamily: "Montserrat_400Regular" },
});
