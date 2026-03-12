import { useCallback } from "react";
import { Platform } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  fetchBillingStatus,
  getDefaultBillingStatus,
  getEffectiveBillingAccess,
  getNativePurchasesAvailability,
  isPremiumActive,
  pollBillingStatus,
  purchaseHostCredit,
  purchasePremium,
  restoreNativePurchases,
  type BillingStatus,
} from "@/lib/billing";
import { trackEvent } from "@/lib/observability";
import { useSupabase } from "@/lib/supabase-context";

function getBillingSource() {
  return Platform.OS === "ios" ? "native_ios" : "stripe";
}

function getBillingErrorCode(error: unknown) {
  if (error && typeof error === "object" && "code" in error) {
    return String((error as { code: unknown }).code);
  }
  return error instanceof Error ? error.name : "unknown_error";
}

export function useBilling() {
  const { member, session } = useSupabase();
  const queryClient = useQueryClient();
  const nativePurchases = getNativePurchasesAvailability();

  const billingQuery = useQuery({
    queryKey: ["billing", member?.id],
    queryFn: fetchBillingStatus,
    enabled: !!member?.id,
  });

  const refreshBilling = useCallback(async (): Promise<BillingStatus> => {
    if (!member?.id) return getDefaultBillingStatus();

    await queryClient.invalidateQueries({ queryKey: ["billing", member.id] });
    return queryClient.fetchQuery({
      queryKey: ["billing", member.id],
      queryFn: fetchBillingStatus,
    });
  }, [member?.id, queryClient]);

  const premiumMutation = useMutation({
    mutationFn: async () => {
      if (!member?.id) throw new Error("Sign in to subscribe.");

      trackEvent("premium_purchase_started", { platform: Platform.OS, source: getBillingSource() });
      await purchasePremium(member.id, session?.user?.email ?? member.email ?? null);

      if (Platform.OS === "ios") {
        return pollBillingStatus((status) => isPremiumActive(status));
      }

      return refreshBilling();
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["billing", member?.id] });
      if (Platform.OS === "ios") {
        trackEvent("premium_purchase_completed", { platform: Platform.OS, source: getBillingSource(), success: true });
      }
    },
    onError: (error) => {
      trackEvent("premium_purchase_failed", {
        platform: Platform.OS,
        source: getBillingSource(),
        success: false,
        error_code: getBillingErrorCode(error),
      });
    },
  });

  const hostCreditMutation = useMutation({
    mutationFn: async () => {
      if (!member?.id) throw new Error("Sign in to buy host credits.");

      const startingBalance = billingQuery.data?.host_credit_balance ?? 0;
      trackEvent("host_credit_purchase_started", { platform: Platform.OS, source: getBillingSource() });
      await purchaseHostCredit(member.id, session?.user?.email ?? member.email ?? null);

      if (Platform.OS === "ios") {
        return pollBillingStatus((status) => status.host_credit_balance > startingBalance);
      }

      return refreshBilling();
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["billing", member?.id] });
      if (Platform.OS === "ios") {
        trackEvent("host_credit_purchase_completed", { platform: Platform.OS, source: getBillingSource(), success: true });
      }
    },
    onError: (error) => {
      trackEvent("host_credit_purchase_failed", {
        platform: Platform.OS,
        source: getBillingSource(),
        success: false,
        error_code: getBillingErrorCode(error),
      });
    },
  });

  const restoreMutation = useMutation({
    mutationFn: async () => {
      if (!member?.id) throw new Error("Sign in to restore purchases.");

      trackEvent("billing_restore_started", { platform: Platform.OS, source: "native_ios" });
      await restoreNativePurchases(member.id, session?.user?.email ?? member.email ?? null);
      return pollBillingStatus((status) => status.host_credit_balance >= 0, 8, 1000);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["billing", member?.id] });
      trackEvent("billing_restore_completed", { platform: Platform.OS, source: "native_ios", success: true });
    },
    onError: (error) => {
      trackEvent("billing_restore_failed", {
        platform: Platform.OS,
        source: "native_ios",
        success: false,
        error_code: getBillingErrorCode(error),
      });
    },
  });

  const status = billingQuery.data ?? getDefaultBillingStatus();
  const effectiveAccess = getEffectiveBillingAccess(status, member?.is_admin);

  return {
    ...billingQuery,
    status,
    premiumActive: isPremiumActive(status),
    hostCreditBalance: status.host_credit_balance ?? 0,
    ...effectiveAccess,
    nativePurchasesAvailable: nativePurchases.nativePurchasesAvailable,
    unsupportedReason: nativePurchases.unsupportedReason,
    refreshBilling,
    purchasePremium: premiumMutation.mutateAsync,
    purchaseHostCredit: hostCreditMutation.mutateAsync,
    restorePurchases: restoreMutation.mutateAsync,
    isPurchasingPremium: premiumMutation.isPending,
    isPurchasingHostCredit: hostCreditMutation.isPending,
    isRestoringPurchases: restoreMutation.isPending,
  };
}
