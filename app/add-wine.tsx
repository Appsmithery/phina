import { View, Text, StyleSheet } from "react-native";
import { router } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { useSupabase } from "@/lib/supabase-context";
import { useTheme } from "@/lib/theme";
import { AddWineForm } from "@/components/AddWineForm";
import { KeyboardAvoidingView, Platform } from "react-native";

export default function AddWineScreen() {
  const { member, session, sessionLoaded } = useSupabase();
  const theme = useTheme();
  const queryClient = useQueryClient();

  const onSuccess = async () => {
    await queryClient.invalidateQueries({ queryKey: ["cellar", "my-wines", member?.id] });
    router.navigate("/(tabs)/cellar");
  };

  const onScan = () => {
    router.push({ pathname: "/scan-label", params: { returnTo: "/add-wine" } });
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
  title: { fontSize: 24, fontWeight: "700", marginBottom: 16, fontFamily: "PlayfairDisplay_700Bold" },
  placeholder: { padding: 16, textAlign: "center", fontFamily: "Montserrat_400Regular" },
});
