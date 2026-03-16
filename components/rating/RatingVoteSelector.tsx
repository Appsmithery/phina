import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useTheme } from "@/lib/theme";

type Vote = -1 | 0 | 1;

type RatingVoteSelectorProps = {
  disabled?: boolean;
  value: Vote | null;
  onChange: (value: Vote) => void;
};

export function RatingVoteSelector({
  disabled = false,
  value,
  onChange,
}: RatingVoteSelectorProps) {
  const theme = useTheme();

  return (
    <View style={styles.voteRow}>
      <TouchableOpacity
        style={[
          styles.voteBtn,
          { backgroundColor: theme.background, borderColor: theme.border },
          value === -1 && { borderColor: theme.primary, borderWidth: 2, backgroundColor: `${theme.primary}10` },
        ]}
        onPress={() => !disabled && onChange(-1)}
        disabled={disabled}
      >
        <Ionicons name="thumbs-down" size={28} color={value === -1 ? theme.thumbsDown : theme.textMuted} />
        <Text style={[styles.voteLabel, { color: value === -1 ? theme.thumbsDown : theme.textMuted }]}>Dislike</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[
          styles.voteBtn,
          { backgroundColor: theme.background, borderColor: theme.border },
          value === 0 && { borderColor: theme.primary, borderWidth: 2, backgroundColor: `${theme.primary}10` },
        ]}
        onPress={() => !disabled && onChange(0)}
        disabled={disabled}
      >
        <MaterialCommunityIcons name="emoticon-neutral-outline" size={28} color={value === 0 ? theme.meh : theme.textMuted} />
        <Text style={[styles.voteLabel, { color: value === 0 ? theme.meh : theme.textMuted }]}>Meh</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[
          styles.voteBtn,
          { backgroundColor: theme.background, borderColor: theme.border },
          value === 1 && { borderColor: theme.primary, borderWidth: 2, backgroundColor: `${theme.primary}10` },
        ]}
        onPress={() => !disabled && onChange(1)}
        disabled={disabled}
      >
        <Ionicons name="thumbs-up" size={28} color={value === 1 ? theme.thumbsUp : theme.textMuted} />
        <Text style={[styles.voteLabel, { color: value === 1 ? theme.thumbsUp : theme.textMuted }]}>Like</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  voteRow: { flexDirection: "row", gap: 12, marginBottom: 28 },
  voteBtn: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1.5,
    paddingVertical: 22,
    alignItems: "center",
    gap: 6,
  },
  voteLabel: { fontSize: 12, fontFamily: "Montserrat_600SemiBold" },
});
