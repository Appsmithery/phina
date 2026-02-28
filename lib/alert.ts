import { Alert, Platform } from "react-native";

type AlertButton = {
  text: string;
  style?: "cancel" | "default" | "destructive";
  onPress?: () => void;
};

/**
 * Cross-platform alert that uses native Alert on iOS/Android
 * and window.alert/confirm on web.
 * Same signature as Alert.alert() — drop-in replacement.
 */
export function showAlert(
  title: string,
  message?: string,
  buttons?: AlertButton[],
) {
  if (Platform.OS !== "web") {
    Alert.alert(title, message, buttons);
    return;
  }

  const text = message ? `${title}\n\n${message}` : title;

  if (!buttons || buttons.length <= 1) {
    window.alert(text);
    buttons?.[0]?.onPress?.();
    return;
  }

  // 2+ buttons → confirm dialog
  const cancelBtn = buttons.find((b) => b.style === "cancel");
  const actionBtn = buttons.find((b) => b.style !== "cancel") ?? buttons[buttons.length - 1];

  if (window.confirm(text)) {
    actionBtn?.onPress?.();
  } else {
    cancelBtn?.onPress?.();
  }
}
