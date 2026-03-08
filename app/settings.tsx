import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Linking, Platform } from "react-native";
import { useEffect, useState } from "react";
import { router } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { showAlert } from "@/lib/alert";
import { formatBirthday, formatBirthdayForStorage, getAge, parseDateOnly } from "@/lib/birthday";
import { BirthdayPickerField } from "@/components/BirthdayPickerField";
import { supabase } from "@/lib/supabase";
import { useSupabase } from "@/lib/supabase-context";
import { useTheme } from "@/lib/theme";
import { US_STATES, getStateLabel } from "@/lib/us-states";
import { stripPhone, isValidPhone, formatPhone, isValidEmail } from "@/lib/validation";
import type { Database } from "@/types/database";

function isMissingMembersColumnError(error: unknown, column: string): boolean {
  if (!error || typeof error !== "object") return false;
  const maybeMessage = "message" in error ? error.message : null;
  return typeof maybeMessage === "string" && maybeMessage.includes(`'${column}' column of 'members'`);
}

export default function SettingsScreen() {
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
        console.warn("[settings] members.city missing in live schema, retrying without city/state", error);
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
      console.warn("[settings] save failed", {
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

  const signOut = async () => {
    await supabase.auth.signOut();
    router.replace("/(auth)");
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView style={styles.scroll} contentContainerStyle={[styles.scrollContent, { paddingBottom: 32 }]} showsVerticalScrollIndicator={false}>
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
});
