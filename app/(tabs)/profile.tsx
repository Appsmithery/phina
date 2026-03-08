import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Linking, Platform } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useCallback, useEffect, useMemo, useState } from "react";
import { router, useFocusEffect } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { showAlert } from "@/lib/alert";
import { formatBirthday, formatBirthdayForStorage, getAge, parseDateOnly } from "@/lib/birthday";
import { ProfileEmptyState } from "@/components/ProfileEmptyState";
import { BirthdayPickerField } from "@/components/BirthdayPickerField";
import { trackEvent } from "@/lib/observability";
import { supabase } from "@/lib/supabase";
import { useSupabase } from "@/lib/supabase-context";
import { useTheme } from "@/lib/theme";
import { US_STATES, getStateLabel } from "@/lib/us-states";
import { stripPhone, isValidPhone, formatPhone, isValidEmail } from "@/lib/validation";
import type { Database } from "@/types/database";

const DONATION_LINKS: Record<number, string> = {
  100: "https://buy.stripe.com/8x214p9RF4XRbCq2y64ZG00",
  500: "https://buy.stripe.com/cNi5kFfbZ2PJ21Q3Ca4ZG01",
  1000: "https://buy.stripe.com/aFaeVfbZNeyr21QdcK4ZG02",
};

function isMissingMembersColumnError(error: unknown, column: string): boolean {
  if (!error || typeof error !== "object") return false;
  const maybeMessage = "message" in error ? error.message : null;
  return typeof maybeMessage === "string" && maybeMessage.includes(`'${column}' column of 'members'`);
}

export default function ProfileScreen() {
  const { member, session, refreshMember } = useSupabase();
  const theme = useTheme();
  const queryClient = useQueryClient();

  const [editingInfo, setEditingInfo] = useState(false);
  const [firstName, setFirstName] = useState(member?.first_name ?? "");
  const [lastName, setLastName] = useState(member?.last_name ?? "");
  const [phone, setPhone] = useState(member?.phone ?? "");
  const [city, setCity] = useState(member?.city ?? "");
  const [stateCode, setStateCode] = useState<string | null>(member?.state ?? null);
  const [showStatePicker, setShowStatePicker] = useState(false);
  const [wineExperience, setWineExperience] = useState<string | null>(member?.wine_experience ?? null);
  const [birthday, setBirthday] = useState<Date | null>(parseDateOnly(member?.birthday));
  const [email, setEmail] = useState(session?.user?.email ?? "");
  const [saving, setSaving] = useState(false);
  const [pwExpanded, setPwExpanded] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  useEffect(() => {
    setFirstName(member?.first_name ?? "");
    setLastName(member?.last_name ?? "");
    setPhone(member?.phone ?? "");
    setCity(member?.city ?? "");
    setStateCode(member?.state ?? null);
    setWineExperience(member?.wine_experience ?? null);
    setBirthday(parseDateOnly(member?.birthday));
    setEmail(session?.user?.email ?? "");
  }, [member?.first_name, member?.last_name, member?.phone, member?.city, member?.state, member?.wine_experience, member?.birthday, session?.user?.email]);

  const { data: ownRatings = [], isLoading: ownRatingsLoading } = useQuery({
    queryKey: ["profile", "ratings", member?.id],
    queryFn: async () => {
      if (!member?.id) return [];
      const { data, error } = await supabase
        .from("ratings")
        .select("value, body, sweetness, tags, wine_id, wines!ratings_wine_id_fkey(color)")
        .eq("member_id", member.id);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!member?.id,
  });

  const { data: eventsCount = 0, isLoading: eventsCountLoading } = useQuery({
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

  useFocusEffect(useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["profile"] });
  }, [queryClient]));

  const stats = useMemo(() => {
    const weights: Record<number, number> = { 1: 3, 0: 1, [-1]: 0 };
    const weightedPreference = (
      ratings: { value: number; trait: string | null }[],
      toNum: (value: string) => number,
    ) => {
      let sumWV = 0;
      let sumW = 0;
      for (const rating of ratings) {
        if (rating.trait == null) continue;
        const weight = weights[rating.value] ?? 0;
        if (weight === 0) continue;
        sumW += weight;
        sumWV += weight * toNum(rating.trait);
      }
      return sumW > 0 ? Math.round((sumWV / sumW) * 10) / 10 : null;
    };

    const totalRatings = ownRatings.length;
    const liked = ownRatings.filter((rating) => rating.value === 1).length;
    const tagScores: Record<string, number> = {};
    for (const rating of ownRatings) {
      const weight = weights[rating.value] ?? 0;
      if (weight === 0) continue;
      for (const tag of rating.tags ?? []) {
        tagScores[tag] = (tagScores[tag] ?? 0) + weight;
      }
    }

    return {
      totalRatings,
      pctLiked: totalRatings > 0 ? Math.round((liked / totalRatings) * 100) : 0,
      eventsAttended: eventsCount,
      favoritesCount,
      prefBody: weightedPreference(ownRatings.map((rating) => ({ value: rating.value, trait: rating.body })), (value) => value === "light" ? 1 : value === "medium" ? 2 : 3),
      prefDryness: weightedPreference(ownRatings.map((rating) => ({ value: rating.value, trait: rating.sweetness })), (value) => value === "dry" ? 1 : value === "off-dry" ? 2 : 3),
      prefColor: weightedPreference(ownRatings.map((rating) => ({ value: rating.value, trait: rating.wines?.color ?? null })), (value) => value === "red" ? 1 : value === "skin-contact" ? 2 : 3),
      preferredTags: (["minerality", "fruit", "spice", "tannic", "oak", "floral"] as const)
        .filter((tag) => (tagScores[tag] ?? 0) > 0)
        .sort((a, b) => (tagScores[b] ?? 0) - (tagScores[a] ?? 0)),
      hasEnoughTagData: ownRatings.some((rating) => (weights[rating.value] ?? 0) > 0 && (rating.tags?.length ?? 0) > 0),
    };
  }, [ownRatings, eventsCount, favoritesCount]);

  const isTopSectionLoading = ownRatingsLoading || eventsCountLoading;
  const shouldShowProfileEmptyState = member?.id != null && !isTopSectionLoading && stats.totalRatings === 0;

  useEffect(() => {
    if (shouldShowProfileEmptyState) trackEvent("profile_empty_state_viewed");
  }, [shouldShowProfileEmptyState]);

  const handleProfileEmptyStatePress = () => {
    trackEvent("profile_empty_state_cta_tapped");
    router.push("/(tabs)");
  };

  const saveProfile = async () => {
    if (!session?.user?.id) return;

    const phoneDigits = stripPhone(phone);
    if (phoneDigits.length > 0 && !isValidPhone(phone)) {
      showAlert("Invalid Phone", "Please enter a valid 10-digit phone number.");
      return;
    }
    if (birthday && getAge(birthday) < 21) {
      showAlert("Age Requirement", "You must be at least 21 years old to use Phina.");
      return;
    }

    const trimmedEmail = email.trim();
    if (trimmedEmail && !isValidEmail(trimmedEmail)) {
      showAlert("Invalid Email", "Please enter a valid email address.");
      return;
    }

    setSaving(true);
    try {
      const trimmedFirst = firstName.trim();
      const trimmedLast = lastName.trim();
      const baseProfileUpdate: Database["public"]["Tables"]["members"]["Update"] = {
        first_name: trimmedFirst || null,
        last_name: trimmedLast || null,
        birthday: birthday ? formatBirthdayForStorage(birthday) : null,
        phone: phoneDigits || null,
        wine_experience: wineExperience as Database["public"]["Tables"]["members"]["Update"]["wine_experience"],
        profile_complete: true,
      };
      const optionalProfileFields: Pick<Database["public"]["Tables"]["members"]["Update"], "city" | "state"> = {
        city: city.trim() || null,
        state: stateCode,
      };

      if (trimmedEmail && trimmedEmail !== session.user.email) {
        const { error: emailError } = await supabase.auth.updateUser({ email: trimmedEmail });
        if (emailError) throw emailError;
        baseProfileUpdate.email = trimmedEmail;
      }

      let profileUpdate: Database["public"]["Tables"]["members"]["Update"] = {
        ...baseProfileUpdate,
        ...optionalProfileFields,
      };

      let { error } = await supabase.from("members").update(profileUpdate).eq("id", session.user.id);
      if (error && isMissingMembersColumnError(error, "city")) {
        console.warn("[profile] members.city missing in live schema, retrying without city/state", error);
        profileUpdate = baseProfileUpdate;
        const retry = await supabase.from("members").update(profileUpdate).eq("id", session.user.id);
        error = retry.error;
      }
      if (error) throw error;

      if (trimmedEmail && trimmedEmail !== session.user.email) {
        showAlert("Confirmation Sent", "A confirmation link has been sent to your new email address. Please check your inbox.");
      }

      await refreshMember();
      queryClient.invalidateQueries({ queryKey: ["members"] });
      setEditingInfo(false);
    } catch (e: unknown) {
      console.warn("[profile] save failed", {
        error: e,
        hasBirthday: !!birthday,
        birthday: birthday ? formatBirthdayForStorage(birthday) : null,
        stateCode,
        hasEmailChange: trimmedEmail !== session.user.email,
      });
      showAlert("Error", e instanceof Error ? e.message : "Could not save");
    } finally {
      setSaving(false);
    }
  };

  const openDonation = async (amountCents: number) => {
    const base = DONATION_LINKS[amountCents];
    const params: string[] = [];
    if (session?.user?.email) params.push(`prefilled_email=${encodeURIComponent(session.user.email)}`);
    if (member?.id) params.push(`client_reference_id=${encodeURIComponent(member.id)}`);
    await Linking.openURL(params.length ? `${base}?${params.join("&")}` : base);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    router.replace("/(auth)");
  };

  const changePassword = async () => {
    if (!session?.user?.email) return;
    if (currentPassword.length === 0) {
      showAlert("Error", "Enter your current password.");
      return;
    }
    if (newPassword.length < 8) {
      showAlert("Error", "New password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmNewPassword) {
      showAlert("Error", "New passwords do not match.");
      return;
    }
    setChangingPassword(true);
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: session.user.email,
        password: currentPassword,
      });
      if (signInError) {
        showAlert("Error", "Current password is incorrect.");
        return;
      }
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      showAlert("Success", "Your password has been updated.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
      setPwExpanded(false);
    } catch (e: unknown) {
      showAlert("Error", e instanceof Error ? e.message : "Could not update password.");
    } finally {
      setChangingPassword(false);
    }
  };

  const renderTopSection = () => {
    if (member?.id == null || isTopSectionLoading) return null;
    if (shouldShowProfileEmptyState) {
      return <ProfileEmptyState theme={theme} onCtaPress={handleProfileEmptyStatePress} />;
    }
    return (
      <>
        <View style={styles.statsGrid}>
          <TouchableOpacity
            style={[styles.statTile, { backgroundColor: theme.surface, borderColor: theme.border }]}
            onPress={() => router.push("/(tabs)/cellar?tab=history")}
          >
            <Text style={[styles.tileValue, { color: theme.text }]}>{stats.totalRatings}</Text>
            <View style={styles.tileLabelRow}>
              <Ionicons name="wine-outline" size={18} color={theme.textSecondary} />
              <Text style={[styles.tileLabel, { color: theme.textSecondary }]}>Wines Rated</Text>
            </View>
          </TouchableOpacity>
          <View style={[styles.statTile, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.tileValue, { color: theme.text }]}>{stats.totalRatings > 0 ? `${stats.pctLiked}%` : "-"}</Text>
            <View style={styles.tileLabelRow}>
              <Ionicons name="thumbs-up-outline" size={18} color={theme.textSecondary} />
              <Text style={[styles.tileLabel, { color: theme.textSecondary }]}>Liked</Text>
            </View>
          </View>
          <TouchableOpacity
            style={[styles.statTile, { backgroundColor: theme.surface, borderColor: theme.border }]}
            onPress={() => router.push("/(tabs)")}
          >
            <Text style={[styles.tileValue, { color: theme.text }]}>{stats.eventsAttended}</Text>
            <View style={styles.tileLabelRow}>
              <Ionicons name="calendar-outline" size={18} color={theme.textSecondary} />
              <Text style={[styles.tileLabel, { color: theme.textSecondary }]}>Events</Text>
            </View>
          </TouchableOpacity>
          <View style={[styles.statTile, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.tileValue, { color: theme.text }]}>{stats.favoritesCount}</Text>
            <View style={styles.tileLabelRow}>
              <Ionicons name="star-outline" size={18} color={theme.textSecondary} />
              <Text style={[styles.tileLabel, { color: theme.textSecondary }]}>Favorites</Text>
            </View>
          </View>
        </View>

        <View style={[styles.card, styles.preferencesCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={[styles.tasteGraphHeader, { marginBottom: 16 }]}>
            <Ionicons name="bar-chart-outline" size={18} color={theme.primary} />
            <Text style={[styles.cardTitle, { color: theme.text }]}>Your Taste Graph</Text>
          </View>

          {[
            ["Body", "Light", "Full", stats.prefBody],
            ["Dryness", "Dry", "Sweet", stats.prefDryness],
          ].map(([label, left, right, pref]) => (
            <View key={String(label)} style={styles.scaleContainer}>
              <Text style={[styles.scaleLabel, { color: theme.textSecondary }]}>{label}</Text>
              <View style={styles.scaleTrackRow}>
                <Text style={[styles.scaleExtreme, { color: theme.textMuted }]}>{left}</Text>
                <View style={styles.scaleTrackWrapper}>
                  <View style={[styles.scaleTrack, { backgroundColor: theme.border }]} />
                  {pref != null && (
                    <View style={[styles.scaleMarker, { backgroundColor: theme.primary, left: `${((Number(pref) - 1) / 2) * 100}%` }]} />
                  )}
                </View>
                <Text style={[styles.scaleExtreme, { color: theme.textMuted }]}>{right}</Text>
              </View>
              {pref == null && <Text style={[styles.noDataText, { color: theme.textMuted }]}>Not enough data</Text>}
            </View>
          ))}

          <View style={styles.scaleContainer}>
            <Text style={[styles.scaleLabel, { color: theme.textSecondary }]}>Palette</Text>
            <View style={styles.scaleTrackRow}>
              <Text style={[styles.scaleExtreme, { color: theme.textMuted }]}>Deep Red</Text>
              <View style={styles.scaleTrackWrapper}>
                <LinearGradient
                  colors={["#8B2035", "#C4956A", "#F0EBE3"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.scaleTrack}
                />
                {stats.prefColor != null && (
                  <View style={[styles.scaleMarker, { backgroundColor: theme.primary, left: `${((stats.prefColor - 1) / 2) * 100}%` }]} />
                )}
              </View>
              <Text style={[styles.scaleExtremeRight, { color: theme.textMuted }]}>Vibrant White</Text>
            </View>
            {stats.prefColor == null && <Text style={[styles.noDataText, { color: theme.textMuted }]}>Not enough data</Text>}
          </View>

          <View style={styles.scaleContainer}>
            <Text style={[styles.scaleLabel, { color: theme.textSecondary }]}>Preferred notes</Text>
            {stats.hasEnoughTagData ? (
              stats.preferredTags.length > 0 ? (
                <View style={styles.tagRow}>
                  {stats.preferredTags.map((tag, idx) => (
                    <View
                      key={tag}
                      style={[
                        styles.tagChip,
                        idx === 0
                          ? { backgroundColor: theme.primary, borderColor: theme.primary }
                          : { backgroundColor: `${theme.primary}20`, borderColor: theme.primary },
                      ]}
                    >
                      <Text style={[styles.tagChipText, { color: idx === 0 ? "#fff" : theme.primary }]}>
                        {tag.charAt(0).toUpperCase() + tag.slice(1)}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={[styles.noDataText, { color: theme.textMuted }]}>No tags on liked wines yet</Text>
              )
            ) : (
              <Text style={[styles.noDataText, { color: theme.textMuted }]}>Not enough data</Text>
            )}
          </View>
        </View>
      </>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.text }]}>Profile</Text>
      </View>
      <ScrollView style={styles.scroll} contentContainerStyle={[styles.scrollContent, { paddingBottom: 32 }]} showsVerticalScrollIndicator={false}>
        {renderTopSection()}
        {Platform.OS !== "ios" && (
          <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={styles.donateHeader}>
              <Ionicons name="heart-outline" size={20} color={theme.primary} />
              <Text style={[styles.cardTitle, { color: theme.text }]}>Support Phina</Text>
            </View>
            <Text style={[styles.donateDescription, { color: theme.textSecondary }]}>Help us keep the cellar growing.</Text>
            <View style={styles.donateButtons}>
              {[100, 500, 1000].map((cents) => (
                <TouchableOpacity
                  key={cents}
                  style={[styles.donateButton, { backgroundColor: theme.primary }]}
                  onPress={() => openDonation(cents)}
                >
                  <Text style={styles.donateButtonText}>${cents / 100}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={styles.infoHeader}>
            <Text style={[styles.cardTitle, { color: theme.text }]}>Personal Info</Text>
            {!editingInfo ? (
              <TouchableOpacity onPress={() => setEditingInfo(true)}>
                <Ionicons name="create-outline" size={20} color={theme.primary} />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                onPress={() => {
                  setFirstName(member?.first_name ?? "");
                  setLastName(member?.last_name ?? "");
                  setPhone(member?.phone ?? "");
                  setCity(member?.city ?? "");
                  setStateCode(member?.state ?? null);
                  setWineExperience(member?.wine_experience ?? null);
                  setBirthday(parseDateOnly(member?.birthday));
                  setEmail(session?.user?.email ?? "");
                  setShowStatePicker(false);
                  setEditingInfo(false);
                }}
              >
                <Text style={[styles.cancelText, { color: theme.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>
            )}
          </View>

          <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>Email</Text>
          {editingInfo ? (
            <TextInput style={[styles.input, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]} value={email} onChangeText={setEmail} placeholder="Your email" placeholderTextColor={theme.textMuted} keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
          ) : (
            <Text style={[styles.infoValue, { color: theme.text }]}>{session?.user?.email ?? "-"}</Text>
          )}

          <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>First name</Text>
          {editingInfo ? (
            <TextInput style={[styles.input, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]} value={firstName} onChangeText={setFirstName} placeholder="First name" placeholderTextColor={theme.textMuted} autoCapitalize="words" />
          ) : (
            <Text style={[styles.infoValue, { color: theme.text }]}>{member?.first_name || "-"}</Text>
          )}

          <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>Last name</Text>
          {editingInfo ? (
            <TextInput style={[styles.input, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]} value={lastName} onChangeText={setLastName} placeholder="Last name" placeholderTextColor={theme.textMuted} autoCapitalize="words" />
          ) : (
            <Text style={[styles.infoValue, { color: theme.text }]}>{member?.last_name || "-"}</Text>
          )}

          <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>Birthday</Text>
          {editingInfo ? (
            <BirthdayPickerField value={birthday} onChange={setBirthday} theme={theme} backgroundColor={theme.background} hintText="Used for age verification only. You must be at least 21 to use Phina." />
          ) : (
            <Text style={[styles.infoValue, { color: theme.text }]}>{member?.birthday ? formatBirthday(parseDateOnly(member.birthday) ?? new Date(member.birthday)) : "-"}</Text>
          )}

          <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>Phone</Text>
          {editingInfo ? (
            <TextInput style={[styles.input, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]} value={phone} onChangeText={setPhone} placeholder="Your phone number" placeholderTextColor={theme.textMuted} keyboardType="phone-pad" />
          ) : (
            <Text style={[styles.infoValue, { color: theme.text }]}>{member?.phone ? formatPhone(member.phone) : "-"}</Text>
          )}

          <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>City</Text>
          {editingInfo ? (
            <TextInput style={[styles.input, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]} value={city} onChangeText={setCity} placeholder="City" placeholderTextColor={theme.textMuted} />
          ) : (
            <Text style={[styles.infoValue, { color: theme.text }]}>{member?.city || "-"}</Text>
          )}

          <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>State</Text>
          {editingInfo ? (
            <>
              <TouchableOpacity style={[styles.input, { backgroundColor: theme.background, borderColor: theme.border, justifyContent: "center" }]} onPress={() => setShowStatePicker(!showStatePicker)}>
                <Text style={{ color: stateCode ? theme.text : theme.textMuted, fontFamily: "Montserrat_400Regular", fontSize: 16 }}>{stateCode ? getStateLabel(stateCode) : "Select state"}</Text>
              </TouchableOpacity>
              {showStatePicker && (
                <View style={[styles.statePickerContainer, { backgroundColor: theme.background, borderColor: theme.border }]}>
                  <ScrollView style={styles.statePickerScroll} nestedScrollEnabled>
                    {US_STATES.map((state) => {
                      const selected = stateCode === state.value;
                      return (
                        <TouchableOpacity key={state.value} style={[styles.stateOption, selected && { backgroundColor: `${theme.primary}15` }]} onPress={() => { setStateCode(selected ? null : state.value); setShowStatePicker(false); }}>
                          <Text style={[styles.stateOptionText, { color: selected ? theme.primary : theme.text }]}>{state.value} - {state.label}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>
              )}
            </>
          ) : (
            <Text style={[styles.infoValue, { color: theme.text }]}>{member?.state ? getStateLabel(member.state) : "-"}</Text>
          )}

          <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>Wine experience</Text>
          {editingInfo ? (
            <View style={styles.profilePillRow}>
              {(["beginner", "intermediate", "advanced", "professional"] as const).map((level) => {
                const selected = wineExperience === level;
                return (
                  <TouchableOpacity key={level} style={[styles.profilePill, { backgroundColor: selected ? theme.primary : theme.background, borderColor: selected ? theme.primary : theme.border }]} onPress={() => setWineExperience(selected ? null : level)}>
                    <Text style={[styles.profilePillText, { color: selected ? "#fff" : theme.textSecondary }]}>{level.charAt(0).toUpperCase() + level.slice(1)}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : (
            <Text style={[styles.infoValue, { color: theme.text }]}>{member?.wine_experience ? member.wine_experience.charAt(0).toUpperCase() + member.wine_experience.slice(1) : "-"}</Text>
          )}

          {editingInfo && (
            <TouchableOpacity style={[styles.button, { backgroundColor: theme.primary, marginTop: 4 }]} onPress={saveProfile} disabled={saving}>
              <Text style={styles.buttonText}>{saving ? "Saving..." : "Save"}</Text>
            </TouchableOpacity>
          )}

          <View style={[styles.divider, { backgroundColor: theme.border }]} />
          <TouchableOpacity style={styles.pwToggleRow} onPress={() => setPwExpanded((value) => !value)}>
            <Text style={[styles.pwToggleText, { color: theme.text }]}>Change password</Text>
            <Ionicons name={pwExpanded ? "chevron-up" : "chevron-forward"} size={18} color={theme.textSecondary} />
          </TouchableOpacity>

          {pwExpanded && (
            <View style={styles.pwForm}>
              <TextInput style={[styles.input, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]} value={currentPassword} onChangeText={setCurrentPassword} placeholder="Current password" placeholderTextColor={theme.textMuted} secureTextEntry />
              <TextInput style={[styles.input, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]} value={newPassword} onChangeText={setNewPassword} placeholder="New password" placeholderTextColor={theme.textMuted} secureTextEntry />
              <TextInput style={[styles.input, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]} value={confirmNewPassword} onChangeText={setConfirmNewPassword} placeholder="Confirm new password" placeholderTextColor={theme.textMuted} secureTextEntry />
              <TouchableOpacity style={[styles.button, { backgroundColor: theme.primary }]} onPress={changePassword} disabled={changingPassword}>
                <Text style={styles.buttonText}>{changingPassword ? "Updating..." : "Update password"}</Text>
              </TouchableOpacity>
            </View>
          )}
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
  card: { borderWidth: 1, borderRadius: 14, padding: 16, marginBottom: 24 },
  cardTitle: { fontFamily: "Montserrat_600SemiBold", fontSize: 16 },
  input: { borderWidth: 1, borderRadius: 12, padding: 12, fontSize: 16, marginBottom: 16, fontFamily: "Montserrat_400Regular" },
  button: { borderRadius: 12, padding: 14, alignItems: "center" },
  buttonText: { color: "#fff", fontWeight: "600", fontFamily: "Montserrat_600SemiBold" },
  signOut: { borderWidth: 1, borderRadius: 12, padding: 14, alignItems: "center" },
  signOutText: { fontSize: 16, fontFamily: "Montserrat_400Regular" },
  legalRow: { flexDirection: "row", justifyContent: "center", alignItems: "center", marginTop: 16, gap: 8 },
  legalLink: { fontSize: 13, fontFamily: "Montserrat_400Regular" },
  legalDot: { fontSize: 13 },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 16 },
  statTile: { width: "48%", borderWidth: 1, borderRadius: 14, padding: 16, alignItems: "center" },
  tileValue: { fontFamily: "PlayfairDisplay_700Bold", fontSize: 28, marginBottom: 4 },
  tileLabelRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  tileLabel: { fontFamily: "Montserrat_400Regular", fontSize: 13, textAlign: "center" },
  preferencesCard: { marginBottom: 24 },
  scaleContainer: { marginBottom: 16 },
  scaleLabel: { fontFamily: "Montserrat_600SemiBold", fontSize: 13, marginBottom: 8 },
  scaleTrackRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  scaleExtreme: { fontFamily: "Montserrat_400Regular", fontSize: 11, width: 40 },
  scaleTrackWrapper: { flex: 1, height: 4, position: "relative" },
  scaleTrack: { width: "100%", height: 4, borderRadius: 2 },
  scaleMarker: { position: "absolute", width: 14, height: 14, borderRadius: 7, top: -5, marginLeft: -7 },
  noDataText: { fontFamily: "Montserrat_400Regular", fontSize: 11, textAlign: "center", marginTop: 4 },
  donateHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  donateDescription: { fontSize: 13, fontFamily: "Montserrat_400Regular", marginBottom: 16, lineHeight: 20 },
  donateButtons: { flexDirection: "row", gap: 12 },
  donateButton: { flex: 1, borderRadius: 12, padding: 14, alignItems: "center" },
  donateButtonText: { color: "#fff", fontWeight: "600", fontFamily: "Montserrat_600SemiBold", fontSize: 16 },
  tagRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 4 },
  tagChip: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 4 },
  tagChipText: { fontSize: 12, fontFamily: "Montserrat_600SemiBold" },
  infoHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  infoLabel: { fontSize: 12, fontFamily: "Montserrat_400Regular", marginBottom: 2 },
  infoValue: { fontSize: 15, fontFamily: "Montserrat_400Regular", marginBottom: 12 },
  cancelText: { fontSize: 14, fontFamily: "Montserrat_400Regular" },
  divider: { height: 1, marginVertical: 16 },
  pwToggleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  pwToggleText: { fontFamily: "Montserrat_400Regular", fontSize: 15 },
  pwForm: { marginTop: 16 },
  statePickerContainer: { borderWidth: 1, borderRadius: 12, marginBottom: 16, overflow: "hidden" },
  statePickerScroll: { maxHeight: 200 },
  stateOption: { paddingHorizontal: 14, paddingVertical: 10 },
  stateOptionText: { fontSize: 15, fontFamily: "Montserrat_400Regular" },
  profilePillRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 },
  profilePill: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  profilePillText: { fontSize: 13, fontFamily: "Montserrat_600SemiBold" },
  header: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  title: { fontSize: 22, fontWeight: "700", fontFamily: "PlayfairDisplay_700Bold" },
  tasteGraphHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  scaleExtremeRight: { fontFamily: "Montserrat_400Regular", fontSize: 11, width: 52, textAlign: "right" },
});
