import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useTheme } from "@/lib/theme";

type BillingCardProps = {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  badge?: string;
  detail?: string;
  primaryLabel: string;
  onPrimaryPress: () => void;
  primaryDisabled?: boolean;
  secondaryLabel?: string;
  onSecondaryPress?: () => void;
  secondaryDisabled?: boolean;
};

export function BillingCard({
  icon,
  title,
  description,
  badge,
  detail,
  primaryLabel,
  onPrimaryPress,
  primaryDisabled = false,
  secondaryLabel,
  onSecondaryPress,
  secondaryDisabled = false,
}: BillingCardProps) {
  const theme = useTheme();

  return (
    <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <View style={styles.header}>
        <View style={[styles.iconWrap, { backgroundColor: `${theme.primary}18` }]}>
          <Ionicons name={icon} size={18} color={theme.primary} />
        </View>
        <View style={styles.headerText}>
          <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
          <Text style={[styles.description, { color: theme.textSecondary }]}>{description}</Text>
        </View>
      </View>

      {badge ? (
        <View style={[styles.badge, { backgroundColor: `${theme.primary}12`, borderColor: `${theme.primary}24` }]}>
          <Text style={[styles.badgeText, { color: theme.primary }]}>{badge}</Text>
        </View>
      ) : null}

      {detail ? <Text style={[styles.detail, { color: theme.textMuted }]}>{detail}</Text> : null}

      <View style={styles.actions}>
        <TouchableOpacity
          style={[
            styles.primaryButton,
            { backgroundColor: theme.primary, opacity: primaryDisabled ? 0.6 : 1 },
          ]}
          onPress={onPrimaryPress}
          disabled={primaryDisabled}
        >
          <Text style={styles.primaryButtonText}>{primaryLabel}</Text>
        </TouchableOpacity>

        {secondaryLabel && onSecondaryPress ? (
          <TouchableOpacity
            style={[
              styles.secondaryButton,
              { borderColor: theme.border, opacity: secondaryDisabled ? 0.6 : 1 },
            ]}
            onPress={onSecondaryPress}
            disabled={secondaryDisabled}
          >
            <Text style={[styles.secondaryButtonText, { color: theme.text }]}>{secondaryLabel}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 18,
    gap: 14,
  },
  header: {
    flexDirection: "row",
    gap: 12,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  headerText: {
    flex: 1,
    gap: 4,
  },
  title: {
    fontSize: 18,
    fontFamily: "PlayfairDisplay_700Bold",
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: "Montserrat_400Regular",
  },
  badge: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  badgeText: {
    fontSize: 12,
    fontFamily: "Montserrat_600SemiBold",
    letterSpacing: 0.3,
  },
  detail: {
    fontSize: 12,
    lineHeight: 18,
    fontFamily: "Montserrat_400Regular",
  },
  actions: {
    flexDirection: "row",
    gap: 10,
  },
  primaryButton: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  primaryButtonText: {
    color: "#fff",
    fontSize: 14,
    fontFamily: "Montserrat_600SemiBold",
  },
  secondaryButton: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  secondaryButtonText: {
    fontSize: 14,
    fontFamily: "Montserrat_600SemiBold",
  },
});
