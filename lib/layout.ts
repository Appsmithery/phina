import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";

export const PAGE_HORIZONTAL_PADDING = 16;
export const PAGE_BOTTOM_PADDING = 32;
export const TAB_HEADER_TOP_OFFSET = 8;
export const TAB_CONTENT_BOTTOM_SPACING = 24;

export function getScreenBottomPadding(bottomInset: number, extra = PAGE_BOTTOM_PADDING): number {
  return Math.max(bottomInset, 0) + extra;
}

export function getTabHeaderPadding(topInset: number): number {
  return Math.max(topInset, 0) + TAB_HEADER_TOP_OFFSET;
}

export function getTabContentBottomPadding(tabBarHeight: number, bottomInset: number): number {
  return tabBarHeight + Math.max(bottomInset, 12) + TAB_CONTENT_BOTTOM_SPACING;
}

export function useOptionalBottomTabBarHeight(fallback = 0): number {
  try {
    return useBottomTabBarHeight();
  } catch {
    return fallback;
  }
}
