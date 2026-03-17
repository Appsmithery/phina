import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useTheme } from "@/lib/theme";

type BillingCardProps = {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description?: string;
  badge?: string;
  detail?: string;
  compact?: boolean;
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
  compact = false,
  primaryLabel,
  onPrimaryPress,
  primaryDisabled = false,
  secondaryLabel,
  onSecondaryPress,
  secondaryDisabled = false,
}: BillingCardProps) {
  const theme = useTheme();

  return (
    <View
      style={[
        styles.card,
        compact && styles.cardCompact,
        { backgroundColor: theme.surface, borderColor: theme.border },
      ]}
    >
      <View style={[styles.header, compact && styles.headerCompact]}>
        <View
          style={[
            styles.iconWrap,
            compact && styles.iconWrapCompact,
            { backgroundColor: `${theme.primary}18` },
          ]}
        >
          <Ionicons name={icon} size={compact ? 16 : 18} color={theme.primary} />
        </View>
        <View style={styles.headerText}>
          <Text style={[styles.title, compact && styles.titleCompact, { color: theme.text }]}>{title}</Text>
          {description ? (
            <Text style={[styles.description, compact && styles.descriptionCompact, { color: theme.textSecondary }]}>
              {description}
            </Text>
          ) : null}
        </View>
      </View>

      {badge ? (
        <View
          style={[
            styles.badge,
            compact && styles.badgeCompact,
            { backgroundColor: `${theme.primary}12`, borderColor: `${theme.primary}24` },
          ]}
        >
          <Text style={[styles.badgeText, compact && styles.badgeTextCompact, { color: theme.primary }]}>
            {badge}
          </Text>
        </View>
      ) : null}

      {detail ? <Text style={[styles.detail, compact && styles.detailCompact, { color: theme.textMuted }]}>{detail}</Text> : null}

      <View style={[styles.actions, compact && styles.actionsCompact]}>
        <TouchableOpacity
          style={[
            styles.primaryButton,
            compact && styles.primaryButtonCompact,
            { backgroundColor: theme.primary, opacity: primaryDisabled ? 0.6 : 1 },
          ]}
          onPress={onPrimaryPress}
          disabled={primaryDisabled}
        >
          <Text style={[styles.primaryButtonText, compact && styles.buttonTextCompact]}>{primaryLabel}</Text>
        </TouchableOpacity>

        {secondaryLabel && onSecondaryPress ? (
          <TouchableOpacity
            style={[
              styles.secondaryButton,
              compact && styles.secondaryButtonCompact,
              { borderColor: theme.border, opacity: secondaryDisabled ? 0.6 : 1 },
            ]}
            onPress={onSecondaryPress}
            disabled={secondaryDisabled}
          >
            <Text style={[styles.secondaryButtonText, compact && styles.buttonTextCompact, { color: theme.text }]}>
              {secondaryLabel}
            </Text>
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
  cardCompact: {
    borderRadius: 16,
    padding: 14,
    gap: 10,
  },
  header: {
    flexDirection: "row",
    gap: 12,
  },
  headerCompact: {
    gap: 10,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  iconWrapCompact: {
    width: 30,
    height: 30,
    borderRadius: 15,
  },
  headerText: {
    flex: 1,
    gap: 4,
  },
  title: {
    fontSize: 18,
    fontFamily: "PlayfairDisplay_700Bold",
  },
  titleCompact: {
    fontSize: 16,
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: "Montserrat_400Regular",
  },
  descriptionCompact: {
    fontSize: 13,
    lineHeight: 18,
  },
  badge: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  badgeCompact: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  badgeText: {
    fontSize: 12,
    fontFamily: "Montserrat_600SemiBold",
    letterSpacing: 0.3,
  },
  badgeTextCompact: {
    fontSize: 11,
  },
  detail: {
    fontSize: 12,
    lineHeight: 18,
    fontFamily: "Montserrat_400Regular",
  },
  detailCompact: {
    lineHeight: 16,
  },
  actions: {
    flexDirection: "row",
    gap: 10,
  },
  actionsCompact: {
    gap: 8,
  },
  primaryButton: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  primaryButtonCompact: {
    borderRadius: 12,
    paddingVertical: 12,
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
  secondaryButtonCompact: {
    borderRadius: 12,
    paddingVertical: 12,
  },
  secondaryButtonText: {
    fontSize: 14,
    fontFamily: "Montserrat_600SemiBold",
  },
  buttonTextCompact: {
    fontSize: 13,
  },
});
