import { KeyboardAvoidingView, Platform, View, Text, StyleSheet } from "react-native";
import { router } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { useSupabase } from "@/lib/supabase-context";
import { useTheme } from "@/lib/theme";
import { trackEvent } from "@/lib/observability";
import { AddWineForm } from "@/components/AddWineForm";
import { BillingCard } from "@/components/BillingCard";
import { useBilling } from "@/hooks/use-billing";
import { showAlert } from "@/lib/alert";

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
    isLoading: billingLoading,
    isPurchasingPremium,
    isRestoringPurchases,
    purchasePremium,
    restorePurchases,
  } = useBilling();

  const onSuccess = async () => {
    await queryClient.invalidateQueries({ queryKey: ["cellar", "my-wines", member?.id] });
    trackEvent("wine_added_to_cellar");
    router.navigate("/(tabs)/cellar");
  };

  const onScan = () => {
    router.push({ pathname: "/scan-label", params: { returnTo: "/add-wine", scanMode: "prefill" } });
  };

  if (!sessionLoaded) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <Text style={[styles.placeholder, { color: theme.textSecondary }]}>Loading…</Text>
      </View>
    );
  }

  if (sessionLoaded && !session) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <Text style={[styles.title, { color: theme.text }]}>Add to cellar</Text>
        <Text style={[styles.placeholder, { color: theme.textSecondary }]}>Sign in to add a wine.</Text>
      </View>
    );
  }

  if (!member?.id) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <Text style={[styles.placeholder, { color: theme.textSecondary }]}>Sign in to add a wine.</Text>
      </View>
    );
  }

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

  if (billingLoading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <Text style={[styles.placeholder, { color: theme.textSecondary }]}>Checking your membership...</Text>
      </View>
    );
  }

  if (!effectivePremiumActive) {
    const premiumDetail =
      unsupportedReason && Platform.OS === "ios" && !nativePurchasesAvailable
        ? `Join and rate events for free, then upgrade when you want long-term collection tracking. ${unsupportedReason}`
        : "Join and rate events for free, then upgrade when you want long-term collection tracking.";
    return (
      <View style={[styles.container, styles.paywallContainer, { backgroundColor: theme.background }]}>
        <Text style={[styles.title, { color: theme.text }]}>Add to cellar</Text>
        <BillingCard
          icon="sparkles-outline"
          title="Premium required"
          description="Adding bottles to your personal cellar is part of the premium membership."
          badge={hasAdminBillingBypass ? (billingAccessLabel ?? "Admin override") : "Cellar premium"}
          detail={premiumDetail}
          primaryLabel={Platform.OS === "ios" && !nativePurchasesAvailable ? "Use iOS Dev Build" : isPurchasingPremium ? "Opening checkout..." : Platform.OS === "ios" ? "Start Premium" : "Subscribe with Stripe"}
          onPrimaryPress={() => {
            void handlePurchasePremium();
          }}
          primaryDisabled={isPurchasingPremium || (Platform.OS === "ios" && !nativePurchasesAvailable)}
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
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardView}
      >
        <Text style={[styles.title, { color: theme.text }]}>Add to cellar</Text>
        <AddWineForm
          eventId={null}
          memberId={member.id}
          onSuccess={onSuccess}
          onScan={onScan}
        />
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  keyboardView: { flex: 1 },
  paywallContainer: { justifyContent: "center", gap: 16 },
  title: { fontSize: 24, fontWeight: "700", marginBottom: 16, fontFamily: "PlayfairDisplay_700Bold" },
  placeholder: { padding: 16, textAlign: "center", fontFamily: "Montserrat_400Regular" },
});
