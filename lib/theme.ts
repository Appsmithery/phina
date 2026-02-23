// Phína brand: Vintage Rosé, Cork Dust, Unbleached Paper, Aged Oak
export const colors = {
  primary: "#B58271",
  secondary: "#D9BBAE",
  background: "#F2EFE9",
  surface: "#FFFFFF",
  text: "#4A3B35",
  textSecondary: "#6B5B54",
  textMuted: "#9A8B82",
  border: "#E5DDD6",
  thumbsUp: "#5A9A6E",
  meh: "#9A8B82",
  thumbsDown: "#B55A5A",
} as const;

export function useTheme() {
  return colors;
}
