import { useCallback } from "react";
import { Platform } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  fetchBillingStatus,
  getBillingErrorMetadata,
  getDefaultBillingStatus,
  getEffectiveBillingAccess,
  getNativePurchasesAvailability,
  isPremiumActive,
  normalizeBillingError,
  pollBillingStatus,
  purchaseHostCredit,
  purchasePremium,
  restoreNativePurchases,
  type BillingStatus,
} from "@/lib/billing";
import { getBillingSource, isNativePurchasesPlatform } from "@/lib/billing-config";
import { trackEvent } from "@/lib/observability";
import { useSupabase } from "@/lib/supabase-context";

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

      trackEvent("premium_purchase_started", { platform: Platform.OS, source: getBillingSource(Platform.OS) });
      await purchasePremium(member.id, session?.user?.email ?? member.email ?? null);

      if (isNativePurchasesPlatform(Platform.OS)) {
        return pollBillingStatus((status) => isPremiumActive(status));
      }

      return refreshBilling();
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["billing", member?.id] });
      if (isNativePurchasesPlatform(Platform.OS)) {
        trackEvent("premium_purchase_completed", {
          platform: Platform.OS,
          source: getBillingSource(Platform.OS),
          success: true,
        });
      }
    },
    onError: (error) => {
      const normalizedError = normalizeBillingError(error, {
        operation: "premium",
        memberId: member?.id ?? null,
      });
      const metadata = getBillingErrorMetadata(normalizedError);

      trackEvent("premium_purchase_failed", {
        platform: Platform.OS,
        source: getBillingSource(Platform.OS),
        success: false,
        error_code: metadata.normalizedCode,
        revenuecat_error_code: metadata.revenueCatCode,
        user_cancelled: metadata.userCancelled,
        package_identifier: metadata.packageIdentifier,
        product_identifier: metadata.productIdentifier,
        member_id: metadata.memberId,
        revenuecat_app_user_id: metadata.revenueCatAppUserId,
        can_make_payments: metadata.canMakePayments,
        unsupported_reason: nativePurchases.unsupportedReason,
      });
    },
  });

  const hostCreditMutation = useMutation({
    mutationFn: async () => {
      if (!member?.id) throw new Error("Sign in to buy host credits.");

      const startingBalance = billingQuery.data?.host_credit_balance ?? 0;
      trackEvent("host_credit_purchase_started", { platform: Platform.OS, source: getBillingSource(Platform.OS) });
      await purchaseHostCredit(member.id, session?.user?.email ?? member.email ?? null);

      if (isNativePurchasesPlatform(Platform.OS)) {
        return pollBillingStatus((status) => status.host_credit_balance > startingBalance);
      }

      return refreshBilling();
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["billing", member?.id] });
      if (isNativePurchasesPlatform(Platform.OS)) {
        trackEvent("host_credit_purchase_completed", {
          platform: Platform.OS,
          source: getBillingSource(Platform.OS),
          success: true,
        });
      }
    },
    onError: (error) => {
      const normalizedError = normalizeBillingError(error, {
        operation: "host_credit",
        memberId: member?.id ?? null,
      });
      const metadata = getBillingErrorMetadata(normalizedError);

      trackEvent("host_credit_purchase_failed", {
        platform: Platform.OS,
        source: getBillingSource(Platform.OS),
        success: false,
        error_code: metadata.normalizedCode,
        revenuecat_error_code: metadata.revenueCatCode,
        user_cancelled: metadata.userCancelled,
        package_identifier: metadata.packageIdentifier,
        product_identifier: metadata.productIdentifier,
        member_id: metadata.memberId,
        revenuecat_app_user_id: metadata.revenueCatAppUserId,
        can_make_payments: metadata.canMakePayments,
        unsupported_reason: nativePurchases.unsupportedReason,
      });
    },
  });

  const restoreMutation = useMutation({
    mutationFn: async () => {
      if (!member?.id) throw new Error("Sign in to restore purchases.");

      trackEvent("billing_restore_started", { platform: Platform.OS, source: getBillingSource(Platform.OS) });
      await restoreNativePurchases(member.id, session?.user?.email ?? member.email ?? null);
      return pollBillingStatus((status) => status.host_credit_balance >= 0, 8, 1000);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["billing", member?.id] });
      trackEvent("billing_restore_completed", {
        platform: Platform.OS,
        source: getBillingSource(Platform.OS),
        success: true,
      });
    },
    onError: (error) => {
      const normalizedError = normalizeBillingError(error, {
        operation: "restore",
        memberId: member?.id ?? null,
      });
      const metadata = getBillingErrorMetadata(normalizedError);

      trackEvent("billing_restore_failed", {
        platform: Platform.OS,
        source: getBillingSource(Platform.OS),
        success: false,
        error_code: metadata.normalizedCode,
        revenuecat_error_code: metadata.revenueCatCode,
        user_cancelled: metadata.userCancelled,
        package_identifier: metadata.packageIdentifier,
        product_identifier: metadata.productIdentifier,
        member_id: metadata.memberId,
        revenuecat_app_user_id: metadata.revenueCatAppUserId,
        can_make_payments: metadata.canMakePayments,
        unsupported_reason: nativePurchases.unsupportedReason,
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
    lastPremiumError: premiumMutation.error
      ? normalizeBillingError(premiumMutation.error, { operation: "premium", memberId: member?.id ?? null })
      : null,
    lastHostCreditError: hostCreditMutation.error
      ? normalizeBillingError(hostCreditMutation.error, { operation: "host_credit", memberId: member?.id ?? null })
      : null,
    lastRestoreError: restoreMutation.error
      ? normalizeBillingError(restoreMutation.error, { operation: "restore", memberId: member?.id ?? null })
      : null,
    refreshBilling,
    purchasePremium: premiumMutation.mutateAsync,
    purchaseHostCredit: hostCreditMutation.mutateAsync,
    restorePurchases: restoreMutation.mutateAsync,
    isPurchasingPremium: premiumMutation.isPending,
    isPurchasingHostCredit: hostCreditMutation.isPending,
    isRestoringPurchases: restoreMutation.isPending,
  };
}
