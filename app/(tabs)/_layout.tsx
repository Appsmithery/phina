import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSupabase } from "@/lib/supabase-context";
import { useTheme } from "@/lib/theme";

export default function TabsLayout() {
  const { member } = useSupabase();
  const theme = useTheme();
  const showAdmin = member?.is_admin === true;
  const visibleTabs = [
    {
      name: "index",
      icon: "calendar-outline" as const,
    },
    {
      name: "cellar",
      icon: "wine-outline" as const,
    },
    {
      name: "pick",
      icon: "search-outline" as const,
    },
    ...(showAdmin
      ? [
          {
            name: "admin",
            icon: "lock-closed-outline" as const,
          },
        ]
      : []),
    {
      name: "profile",
      icon: "person-outline" as const,
    },
  ];

  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        headerTitle: "",
        headerStyle: { backgroundColor: theme.background },
        headerShadowVisible: false,
        headerTintColor: theme.primary,
        tabBarShowLabel: false,
        tabBarActiveTintColor: theme.primary,
        tabBarInactiveTintColor: theme.textMuted,
        tabBarItemStyle: { flex: 1 },
        tabBarStyle: { backgroundColor: theme.surface, borderTopColor: theme.border },
      }}
    >
      {visibleTabs.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            tabBarLabel: tab.name === "admin" ? "Admin" : undefined,
            tabBarIcon: ({ color, size }) => <Ionicons name={tab.icon} size={size} color={color} />,
          }}
        />
      ))}
    </Tabs>
  );
}
