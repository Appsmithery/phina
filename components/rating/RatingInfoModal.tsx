import { Ionicons } from "@expo/vector-icons";
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useTheme } from "@/lib/theme";

export type RatingInfoKey = "body" | "dryness" | "confidence" | "tastingNotes";

type RatingInfoDefinition = {
  title: string;
  body: string;
};

export const RATING_INFO_DEFINITIONS: Record<RatingInfoKey, RatingInfoDefinition> = {
  body: {
    title: "Body",
    body: "How heavy or rich the wine feels in your mouth. Light is crisp and delicate, medium is balanced, and full feels broader and weightier.",
  },
  dryness: {
    title: "Dryness",
    body: "How much sweetness you perceive. Dry has little to no sweetness, off-dry has a touch, and sweet is clearly sugary.",
  },
  confidence: {
    title: "Confidence",
    body: "How sure you are about this rating. Use a lower confidence if you are guessing or still learning the style.",
  },
  tastingNotes: {
    title: "Tasting Notes",
    body: "Pick the flavors or structure cues that stand out most, then add a short note if you want extra context.",
  },
};

type RatingSectionHeaderProps = {
  title: string;
  infoKey: RatingInfoKey;
  onOpenInfo: (key: RatingInfoKey) => void;
  value?: string | null;
  marginBottom?: number;
};

export function RatingSectionHeader({
  title,
  infoKey,
  onOpenInfo,
  value,
  marginBottom,
}: RatingSectionHeaderProps) {
  const theme = useTheme();

  return (
    <View style={[styles.headerRow, marginBottom != null && { marginBottom }]}>
      <View style={styles.headerLead}>
        <Text style={[styles.headerTitle, { color: theme.text }]}>{title}</Text>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={`Show ${title} definition`}
          hitSlop={10}
          onPress={() => onOpenInfo(infoKey)}
        >
          <Ionicons name="information-circle-outline" size={20} color={theme.textMuted} />
        </TouchableOpacity>
      </View>
      {value ? <Text style={[styles.headerValue, { color: theme.primary }]}>{value}</Text> : null}
    </View>
  );
}

type RatingInfoModalProps = {
  infoKey: RatingInfoKey | null;
  visible: boolean;
  onClose: () => void;
};

export function RatingInfoModal({ infoKey, visible, onClose }: RatingInfoModalProps) {
  const theme = useTheme();
  const definition = infoKey ? RATING_INFO_DEFINITIONS[infoKey] : null;

  if (!definition) {
    return null;
  }

  return (
    <Modal
      animationType="fade"
      transparent
      visible={visible}
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable
          testID="rating-info-modal"
          style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}
          onPress={(event) => event.stopPropagation()}
        >
          <View style={styles.titleRow}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>{definition.title}</Text>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Close definition"
              hitSlop={10}
              onPress={onClose}
            >
              <Ionicons name="close" size={20} color={theme.textMuted} />
            </TouchableOpacity>
          </View>
          <Text style={[styles.modalBody, { color: theme.textSecondary }]}>{definition.body}</Text>
          <TouchableOpacity
            style={[styles.doneButton, { backgroundColor: theme.primary }]}
            onPress={onClose}
          >
            <Text style={styles.doneButtonText}>Done</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerLead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingRight: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: "PlayfairDisplay_700Bold",
  },
  headerValue: {
    fontSize: 13,
    fontFamily: "Montserrat_600SemiBold",
    letterSpacing: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.35)",
    padding: 24,
    justifyContent: "center",
  },
  card: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 20,
    gap: 16,
  },
  titleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  modalTitle: {
    flex: 1,
    fontSize: 22,
    fontFamily: "PlayfairDisplay_700Bold",
  },
  modalBody: {
    fontSize: 15,
    lineHeight: 22,
    fontFamily: "Montserrat_400Regular",
  },
  doneButton: {
    alignSelf: "flex-end",
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  doneButtonText: {
    color: "#fff",
    fontSize: 14,
    fontFamily: "Montserrat_600SemiBold",
  },
});
