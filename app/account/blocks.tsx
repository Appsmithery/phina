import { Stack } from "expo-router";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { useBlockedMembersList, useUnblockMemberMutation } from "@/hooks/use-member-blocks";
import { showAlert } from "@/lib/alert";
import { PAGE_HORIZONTAL_PADDING, getScreenBottomPadding } from "@/lib/layout";
import { formatMemberLabel } from "@/lib/member-blocks";
import { useTheme } from "@/lib/theme";

export default function BlockedMembersScreen() {
  const theme = useTheme();
  const { data: blockedMembers = [], isLoading } = useBlockedMembersList();
  const unblockMemberMutation = useUnblockMemberMutation();

  const handleUnblock = (blockedMemberId: string, label: string) => {
    showAlert(
      "Unblock member?",
      `You'll be able to see events and wines from ${label} again.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Unblock",
          onPress: async () => {
            try {
              await unblockMemberMutation.mutateAsync(blockedMemberId);
            } catch (error) {
              showAlert(
                "Could not unblock member",
                error instanceof Error ? error.message : "Please try again.",
              );
            }
          },
        },
      ],
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Stack.Screen options={{ title: "Blocked Members" }} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.title, { color: theme.text }]}>Blocked members</Text>
        <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
          Blocking hides a member's events and wines from your app surfaces. You can reverse that here.
        </Text>

        {isLoading ? (
          <View style={styles.loadingState}>
            <ActivityIndicator color={theme.primary} />
            <Text style={[styles.loadingText, { color: theme.textMuted }]}>Loading blocked members...</Text>
          </View>
        ) : blockedMembers.length === 0 ? (
          <View style={[styles.emptyState, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.emptyTitle, { color: theme.text }]}>No blocked members</Text>
            <Text style={[styles.emptyBody, { color: theme.textSecondary }]}>
              If you block a host or contributor from an event or wine screen, they'll appear here.
            </Text>
          </View>
        ) : (
          blockedMembers.map((blockedMember) => {
            const label = formatMemberLabel(blockedMember);

            return (
              <View
                key={blockedMember.id}
                style={[styles.memberCard, { backgroundColor: theme.surface, borderColor: theme.border }]}
              >
                <View style={styles.memberText}>
                  <Text style={[styles.memberName, { color: theme.text }]}>{label}</Text>
                  <Text style={[styles.memberMeta, { color: theme.textSecondary }]}>
                    {blockedMember.email}
                  </Text>
                </View>
                <TouchableOpacity
                  style={[styles.unblockButton, { borderColor: theme.border }]}
                  onPress={() => handleUnblock(blockedMember.id, label)}
                >
                  <Text style={[styles.unblockButtonText, { color: theme.text }]}>Unblock</Text>
                </TouchableOpacity>
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: PAGE_HORIZONTAL_PADDING,
    paddingTop: 20,
    paddingBottom: getScreenBottomPadding(0),
  },
  title: {
    fontSize: 28,
    fontFamily: "PlayfairDisplay_700Bold",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    fontFamily: "Montserrat_400Regular",
    marginBottom: 20,
  },
  loadingState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 32,
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    fontFamily: "Montserrat_400Regular",
  },
  emptyState: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 20,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontFamily: "Montserrat_600SemiBold",
  },
  emptyBody: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: "Montserrat_400Regular",
  },
  memberCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  memberText: {
    flex: 1,
    gap: 4,
  },
  memberName: {
    fontSize: 15,
    fontFamily: "Montserrat_600SemiBold",
  },
  memberMeta: {
    fontSize: 13,
    fontFamily: "Montserrat_400Regular",
  },
  unblockButton: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  unblockButtonText: {
    fontSize: 14,
    fontFamily: "Montserrat_600SemiBold",
  },
});
