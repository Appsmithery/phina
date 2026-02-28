import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet } from "react-native";
import { showAlert } from "@/lib/alert";
import { useEffect, useMemo, useState } from "react";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { useSupabase } from "@/lib/supabase-context";
import { useTheme } from "@/lib/theme";
import { supabase } from "@/lib/supabase";
import { useQueryClient } from "@tanstack/react-query";

const MIN_PASSWORD_LENGTH = 8;

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
        .select("value, body, sweetness, wine_id, wines!ratings_wine_id_fkey(color)")
        .eq("member_id", member.id);
      if (error) throw error;
      return data ?? [];
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

  const { data: favoritesCount = 0 } = useQuery({
    queryKey: ["profile", "favorites", member?.id],
    queryFn: async () => {
      if (!member?.id) return 0;
      const { count, error } = await supabase
        .from("event_favorites")
        .select("wine_id", { count: "exact", head: true })
        .eq("member_id", member.id);
      if (error) throw error;
      return count ?? 0;
    },
    enabled: !!member?.id,
  });

  const stats = useMemo(() => {
    const PREF_WEIGHT: Record<number, number> = { 1: 3, 0: 1, [-1]: 0 };

    function weightedPreference(
      ratings: { value: number; trait: string | null }[],
      toNum: (v: string) => number,
    ): number | null {
      let sumWV = 0;
      let sumW = 0;
      for (const r of ratings) {
        if (r.trait == null) continue;
        const w = PREF_WEIGHT[r.value] ?? 0;
        if (w === 0) continue;
        sumW += w;
        sumWV += w * toNum(r.trait);
      }
      return sumW > 0 ? Math.round((sumWV / sumW) * 10) / 10 : null;
    }

    const bodyToNum = (v: string) => (v === "light" ? 1 : v === "medium" ? 2 : 3);
    const sweetnessToNum = (v: string) => (v === "dry" ? 1 : v === "off-dry" ? 2 : 3);
    const colorToNum = (v: string) => (v === "red" ? 1 : v === "skin-contact" ? 2 : 3);

    const total = ownRatings.length;
    const liked = ownRatings.filter((r) => r.value === 1).length;
    const pctLiked = total > 0 ? Math.round((liked / total) * 100) : 0;

    const prefBody = weightedPreference(
      ownRatings.map((r) => ({ value: r.value, trait: r.body })),
      bodyToNum,
    );
    const prefDryness = weightedPreference(
      ownRatings.map((r) => ({ value: r.value, trait: r.sweetness })),
      sweetnessToNum,
    );
    const prefColor = weightedPreference(
      ownRatings.map((r) => ({
        value: r.value,
        trait: r.wines?.color ?? null,
      })),
      colorToNum,
    );

    return {
      totalRatings: total,
      liked,
      pctLiked,
      eventsAttended: eventsCount,
      favoritesCount,
      prefBody,
      prefDryness,
      prefColor,
    };
  }, [ownRatings, eventsCount, favoritesCount]);

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
      showAlert("Error", e instanceof Error ? e.message : "Could not save");
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
      showAlert("Error", `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (newPassword !== confirmNewPassword) {
      showAlert("Error", "Passwords do not match.");
      return;
    }
    setChangingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      showAlert("Success", "Your password has been updated.");
      setNewPassword("");
      setConfirmNewPassword("");
    } catch (e: unknown) {
      showAlert("Error", e instanceof Error ? e.message : "Could not update password.");
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
          <>
            <View style={styles.statsGrid}>
              <View style={[styles.statTile, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <Text style={[styles.tileValue, { color: theme.text }]}>{stats.totalRatings}</Text>
                <View style={styles.tileLabelRow}>
                  <Ionicons name="wine-outline" size={18} color={theme.textSecondary} />
                  <Text style={[styles.tileLabel, { color: theme.textSecondary }]}>Wines Rated</Text>
                </View>
              </View>
              <View style={[styles.statTile, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <Text style={[styles.tileValue, { color: theme.text }]}>
                  {stats.totalRatings > 0 ? `${stats.pctLiked}%` : "—"}
                </Text>
                <View style={styles.tileLabelRow}>
                  <Ionicons name="thumbs-up-outline" size={18} color={theme.textSecondary} />
                  <Text style={[styles.tileLabel, { color: theme.textSecondary }]}>Liked</Text>
                </View>
              </View>
              <View style={[styles.statTile, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <Text style={[styles.tileValue, { color: theme.text }]}>{stats.eventsAttended}</Text>
                <View style={styles.tileLabelRow}>
                  <Ionicons name="calendar-outline" size={18} color={theme.textSecondary} />
                  <Text style={[styles.tileLabel, { color: theme.textSecondary }]}>Events</Text>
                </View>
              </View>
              <View style={[styles.statTile, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <Text style={[styles.tileValue, { color: theme.text }]}>{stats.favoritesCount}</Text>
                <View style={styles.tileLabelRow}>
                  <Ionicons name="star-outline" size={18} color={theme.textSecondary} />
                  <Text style={[styles.tileLabel, { color: theme.textSecondary }]}>Favorites</Text>
                </View>
              </View>
            </View>
            <View style={[styles.card, styles.preferencesCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Text style={[styles.preferencesTitle, { color: theme.text }]}>Preferences</Text>
              
              <View style={styles.scaleContainer}>
                <Text style={[styles.scaleLabel, { color: theme.textSecondary }]}>Body</Text>
                <View style={styles.scaleTrackRow}>
                  <Text style={[styles.scaleExtreme, { color: theme.textMuted }]}>Light</Text>
                  <View style={styles.scaleTrackWrapper}>
                    <View style={[styles.scaleTrack, { backgroundColor: theme.border }]} />
                    {stats.prefBody != null && (
                      <View style={[styles.scaleMarker, { backgroundColor: theme.primary, left: `${((stats.prefBody - 1) / 2) * 100}%` }]} />
                    )}
                  </View>
                  <Text style={[styles.scaleExtreme, { color: theme.textMuted }]}>Full</Text>
                </View>
                {stats.prefBody == null && (
                  <Text style={[styles.noDataText, { color: theme.textMuted }]}>Not enough data</Text>
                )}
              </View>

              <View style={styles.scaleContainer}>
                <Text style={[styles.scaleLabel, { color: theme.textSecondary }]}>Dryness</Text>
                <View style={styles.scaleTrackRow}>
                  <Text style={[styles.scaleExtreme, { color: theme.textMuted }]}>Dry</Text>
                  <View style={styles.scaleTrackWrapper}>
                    <View style={[styles.scaleTrack, { backgroundColor: theme.border }]} />
                    {stats.prefDryness != null && (
                      <View style={[styles.scaleMarker, { backgroundColor: theme.primary, left: `${((stats.prefDryness - 1) / 2) * 100}%` }]} />
                    )}
                  </View>
                  <Text style={[styles.scaleExtreme, { color: theme.textMuted }]}>Sweet</Text>
                </View>
                {stats.prefDryness == null && (
                  <Text style={[styles.noDataText, { color: theme.textMuted }]}>Not enough data</Text>
                )}
              </View>

              <View style={styles.scaleContainer}>
                <Text style={[styles.scaleLabel, { color: theme.textSecondary }]}>Color</Text>
                <View style={styles.scaleTrackRow}>
                  <Text style={[styles.scaleExtreme, { color: theme.textMuted }]}>Red</Text>
                  <View style={styles.scaleTrackWrapper}>
                    <View style={[styles.scaleTrack, { backgroundColor: theme.border }]} />
                    {stats.prefColor != null && (
                      <View style={[styles.scaleMarker, { backgroundColor: theme.primary, left: `${((stats.prefColor - 1) / 2) * 100}%` }]} />
                    )}
                  </View>
                  <Text style={[styles.scaleExtreme, { color: theme.textMuted }]}>White</Text>
                </View>
                {stats.prefColor == null && (
                  <Text style={[styles.noDataText, { color: theme.textMuted }]}>Not enough data</Text>
                )}
              </View>
            </View>
          </>
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
        <View style={styles.legalRow}>
          <TouchableOpacity onPress={() => router.push("/privacy")}>
            <Text style={[styles.legalLink, { color: theme.textMuted }]}>Privacy Policy</Text>
          </TouchableOpacity>
          <Text style={[styles.legalDot, { color: theme.textMuted }]}>&middot;</Text>
          <TouchableOpacity onPress={() => router.push("/terms")}>
            <Text style={[styles.legalLink, { color: theme.textMuted }]}>Terms of Service</Text>
          </TouchableOpacity>
        </View>
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
  label: { fontSize: 12, marginBottom: 4, fontFamily: "Montserrat_400Regular" },
  value: { fontSize: 16, marginBottom: 16, fontFamily: "Montserrat_400Regular" },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
    marginBottom: 16,
    fontFamily: "Montserrat_400Regular",
  },
  button: { borderRadius: 12, padding: 14, alignItems: "center" },
  buttonText: { color: "#fff", fontWeight: "600", fontFamily: "Montserrat_600SemiBold" },
  signOut: { borderWidth: 1, borderRadius: 12, padding: 14, alignItems: "center" },
  signOutText: { fontSize: 16, fontFamily: "Montserrat_400Regular" },
  legalRow: { flexDirection: "row", justifyContent: "center", alignItems: "center", marginTop: 16, gap: 8 },
  legalLink: { fontSize: 13, fontFamily: "Montserrat_400Regular" },
  legalDot: { fontSize: 13 },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 16,
  },
  statTile: {
    width: "48%",
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    alignItems: "center",
  },
  tileValue: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 28,
    marginBottom: 4,
  },
  tileLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  tileLabel: {
    fontFamily: "Montserrat_400Regular",
    fontSize: 13,
    textAlign: "center",
  },
  preferencesCard: {
    marginBottom: 24,
  },
  preferencesTitle: {
    fontFamily: "Montserrat_600SemiBold",
    fontSize: 16,
    marginBottom: 16,
  },
  scaleContainer: {
    marginBottom: 16,
  },
  scaleLabel: {
    fontFamily: "Montserrat_600SemiBold",
    fontSize: 13,
    marginBottom: 8,
  },
  scaleTrackRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  scaleExtreme: {
    fontFamily: "Montserrat_400Regular",
    fontSize: 11,
    width: 40,
  },
  scaleTrackWrapper: {
    flex: 1,
    height: 4,
    position: "relative",
  },
  scaleTrack: {
    width: "100%",
    height: 4,
    borderRadius: 2,
  },
  scaleMarker: {
    position: "absolute",
    width: 14,
    height: 14,
    borderRadius: 7,
    top: -5,
    marginLeft: -7,
  },
  noDataText: {
    fontFamily: "Montserrat_400Regular",
    fontSize: 11,
    textAlign: "center",
    marginTop: 4,
  },
});
