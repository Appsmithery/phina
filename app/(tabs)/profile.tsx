import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Alert } from "react-native";
import { useEffect, useMemo, useState } from "react";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useSupabase } from "@/lib/supabase-context";
import { useTheme } from "@/lib/theme";
import { supabase } from "@/lib/supabase";
import { useQueryClient } from "@tanstack/react-query";

const MIN_PASSWORD_LENGTH = 6;

export default function ProfileScreen() {
  const { member, session, refreshMember } = useSupabase();
  const theme = useTheme();
  const [name, setName] = useState(member?.name ?? "");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  useEffect(() => {
    setName(member?.name ?? "");
  }, [member?.name]);
  const [saving, setSaving] = useState(false);
  const queryClient = useQueryClient();

  const { data: ownRatings = [] } = useQuery({
    queryKey: ["profile", "ratings", member?.id],
    queryFn: async () => {
      if (!member?.id) return [];
      const { data, error } = await supabase
        .from("ratings")
        .select("value, body, sweetness")
        .eq("member_id", member.id);
      if (error) throw error;
      return (data ?? []) as { value: number; body: string | null; sweetness: string | null }[];
    },
    enabled: !!member?.id,
  });

  const { data: eventsCount = 0 } = useQuery({
    queryKey: ["profile", "event_members", member?.id],
    queryFn: async () => {
      if (!member?.id) return 0;
      const { count, error } = await supabase
        .from("event_members")
        .select("event_id", { count: "exact", head: true })
        .eq("member_id", member.id);
      if (error) throw error;
      return count ?? 0;
    },
    enabled: !!member?.id,
  });

  const stats = useMemo(() => {
    const total = ownRatings.length;
    const liked = ownRatings.filter((r) => r.value === 1).length;
    const pctLiked = total > 0 ? Math.round((liked / total) * 100) : 0;
    const bodyNums = ownRatings
      .filter((r) => r.body != null)
      .map((r) => (r.body === "light" ? 1 : r.body === "medium" ? 2 : 3));
    const sweetnessNums = ownRatings
      .filter((r) => r.sweetness != null)
      .map((r) => (r.sweetness === "dry" ? 1 : r.sweetness === "off-dry" ? 2 : 3));
    const avgBody =
      bodyNums.length > 0
        ? bodyNums.reduce((a, b) => a + b, 0) / bodyNums.length
        : null;
    const avgSweetness =
      sweetnessNums.length > 0
        ? sweetnessNums.reduce((a, b) => a + b, 0) / sweetnessNums.length
        : null;
    const bodyLabel =
      avgBody != null
        ? avgBody <= 1.5
          ? "Light"
          : avgBody <= 2.5
            ? "Medium"
            : "Full"
        : null;
    const drynessLabel =
      avgSweetness != null
        ? avgSweetness <= 1.5
          ? "Dry"
          : avgSweetness <= 2.5
            ? "Off-dry"
            : "Sweet"
        : null;
    return {
      totalRatings: total,
      liked,
      pctLiked,
      eventsAttended: eventsCount,
      avgBody: avgBody != null ? Math.round(avgBody * 10) / 10 : null,
      avgDryness: avgSweetness != null ? Math.round(avgSweetness * 10) / 10 : null,
      bodyLabel,
      drynessLabel,
    };
  }, [ownRatings, eventsCount]);

  const saveProfile = async () => {
    if (!session?.user?.id) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("members")
        .upsert(
          {
            id: session.user.id,
            email: session.user.email!,
            name: name.trim() || null,
          },
          { onConflict: "id" }
        );
      if (error) throw error;
      await refreshMember();
      queryClient.invalidateQueries({ queryKey: ["members"] });
    } catch (e: unknown) {
      Alert.alert("Error", e instanceof Error ? e.message : "Could not save");
    } finally {
      setSaving(false);
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    router.replace("/(auth)");
  };

  const changePassword = async () => {
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      Alert.alert("Error", `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (newPassword !== confirmNewPassword) {
      Alert.alert("Error", "Passwords do not match.");
      return;
    }
    setChangingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      Alert.alert("Success", "Your password has been updated.");
      setNewPassword("");
      setConfirmNewPassword("");
    } catch (e: unknown) {
      Alert.alert("Error", e instanceof Error ? e.message : "Could not update password.");
    } finally {
      setChangingPassword(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 32 }]}
        showsVerticalScrollIndicator={false}
      >
        {member?.id != null ? (
          <View style={[styles.card, styles.statsCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.statsTitle, { color: theme.text }]}>Stats</Text>
            <View style={styles.statsRow}>
              <Text style={[styles.statsLabel, { color: theme.textSecondary }]}>Wines rated</Text>
              <Text style={[styles.statsValue, { color: theme.text }]}>{stats.totalRatings}</Text>
            </View>
            <View style={styles.statsRow}>
              <Text style={[styles.statsLabel, { color: theme.textSecondary }]}>Liked</Text>
              <Text style={[styles.statsValue, { color: theme.text }]}>
                {stats.totalRatings > 0 ? `${stats.pctLiked}%` : "—"}
              </Text>
            </View>
            <View style={styles.statsRow}>
              <Text style={[styles.statsLabel, { color: theme.textSecondary }]}>Events attended</Text>
              <Text style={[styles.statsValue, { color: theme.text }]}>{stats.eventsAttended}</Text>
            </View>
            {stats.avgBody != null ? (
              <View style={styles.statsRow}>
                <Text style={[styles.statsLabel, { color: theme.textSecondary }]}>Avg body</Text>
                <Text style={[styles.statsValue, { color: theme.text }]}>
                  {stats.bodyLabel} ({stats.avgBody})
                </Text>
              </View>
            ) : null}
            {stats.avgDryness != null ? (
              <View style={styles.statsRow}>
                <Text style={[styles.statsLabel, { color: theme.textSecondary }]}>Avg dryness</Text>
                <Text style={[styles.statsValue, { color: theme.text }]}>
                  {stats.drynessLabel} ({stats.avgDryness})
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}
        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.label, { color: theme.textSecondary }]}>Email</Text>
          <Text style={[styles.value, { color: theme.text }]}>{session?.user?.email ?? "—"}</Text>
          <Text style={[styles.label, { color: theme.textSecondary }]}>Name</Text>
          <TextInput
            style={[styles.input, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]}
            value={name}
            onChangeText={setName}
            placeholder="Your name"
            placeholderTextColor={theme.textMuted}
          />
          <TouchableOpacity
            style={[styles.button, { backgroundColor: theme.primary }]}
            onPress={saveProfile}
            disabled={saving}
          >
            <Text style={styles.buttonText}>{saving ? "Saving…" : "Save"}</Text>
          </TouchableOpacity>
        </View>
        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.label, { color: theme.textSecondary }]}>Change password</Text>
          <TextInput
            style={[styles.input, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]}
            value={newPassword}
            onChangeText={setNewPassword}
            placeholder="New password"
            placeholderTextColor={theme.textMuted}
            secureTextEntry
          />
          <TextInput
            style={[styles.input, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]}
            value={confirmNewPassword}
            onChangeText={setConfirmNewPassword}
            placeholder="Confirm new password"
            placeholderTextColor={theme.textMuted}
            secureTextEntry
          />
          <TouchableOpacity
            style={[styles.button, { backgroundColor: theme.primary }]}
            onPress={changePassword}
            disabled={changingPassword}
          >
            <Text style={styles.buttonText}>{changingPassword ? "Updating…" : "Change password"}</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity style={[styles.signOut, { borderColor: theme.border }]} onPress={signOut}>
          <Text style={[styles.signOutText, { color: theme.textSecondary }]}>Sign out</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { padding: 16 },
  card: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    marginBottom: 24,
  },
  label: { fontSize: 12, marginBottom: 4 },
  value: { fontSize: 16, marginBottom: 16 },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
    marginBottom: 16,
  },
  button: { borderRadius: 12, padding: 14, alignItems: "center" },
  buttonText: { color: "#fff", fontWeight: "600" },
  signOut: { borderWidth: 1, borderRadius: 12, padding: 14, alignItems: "center" },
  signOutText: { fontSize: 16 },
  statsCard: { marginBottom: 24 },
  statsTitle: { fontSize: 14, fontWeight: "600", marginBottom: 12 },
  statsRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  statsLabel: { fontSize: 14 },
  statsValue: { fontSize: 16, fontWeight: "500" },
});
