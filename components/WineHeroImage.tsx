import { Image, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface WineHeroImageProps {
  displayPhotoUrl?: string | null;
  labelPhotoUrl?: string | null;
  imageGenerationStatus?: string | null;
  backgroundColor: string;
  borderColor: string;
  accentColor: string;
  textColor: string;
  textSecondaryColor: string;
  style?: StyleProp<ViewStyle>;
  showEnhancedBadge?: boolean;
}

export function WineHeroImage({
  displayPhotoUrl,
  labelPhotoUrl,
  imageGenerationStatus,
  backgroundColor,
  borderColor,
  accentColor,
  textColor,
  textSecondaryColor,
  style,
  showEnhancedBadge = true,
}: WineHeroImageProps) {
  const hasGeneratedImage = imageGenerationStatus === "generated" && !!displayPhotoUrl;
  const isImagePending = imageGenerationStatus === "pending" && !displayPhotoUrl;
  const fallbackPhotoUrl =
    !hasGeneratedImage && !isImagePending ? (displayPhotoUrl ?? labelPhotoUrl ?? null) : null;

  if (!isImagePending && !hasGeneratedImage && !fallbackPhotoUrl) {
    return null;
  }

  return (
    <View
      style={[
        styles.container,
        { backgroundColor },
        style,
        isImagePending ? { borderWidth: 1, borderColor, paddingHorizontal: 28 } : null,
      ]}
    >
      {isImagePending ? (
        <>
          <Ionicons name="image-outline" size={34} color={accentColor} style={styles.pendingIcon} />
          <Text style={[styles.pendingTitle, { color: textColor }]}>Image generation in progress</Text>
          <Text style={[styles.pendingBody, { color: textSecondaryColor }]}>
            Your enhanced bottle photo will appear here shortly.
          </Text>
        </>
      ) : (
        <>
          <Image
            source={{ uri: hasGeneratedImage ? displayPhotoUrl ?? "" : fallbackPhotoUrl ?? "" }}
            style={styles.image}
            resizeMode={hasGeneratedImage ? "cover" : "contain"}
          />
          {hasGeneratedImage && showEnhancedBadge ? (
            <View style={[styles.badge, { backgroundColor: `${accentColor}20` }]}>
              <Text style={[styles.badgeText, { color: accentColor }]}>Enhanced from scan</Text>
            </View>
          ) : null}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    aspectRatio: 3 / 4,
    marginBottom: 16,
    borderRadius: 14,
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
  },
  pendingIcon: {
    marginBottom: 14,
  },
  pendingTitle: {
    fontSize: 20,
    fontFamily: "PlayfairDisplay_600SemiBold",
    textAlign: "center",
    marginBottom: 8,
  },
  pendingBody: {
    fontSize: 14,
    lineHeight: 22,
    fontFamily: "Montserrat_400Regular",
    textAlign: "center",
    maxWidth: 240,
  },
  image: {
    width: "100%",
    height: "100%",
  },
  badge: {
    position: "absolute",
    bottom: 12,
    right: 12,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  badgeText: {
    fontSize: 10,
    fontFamily: "Montserrat_600SemiBold",
  },
});
