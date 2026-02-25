import { Tabs } from "expo-router";
import { Image } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSupabase } from "@/lib/supabase-context";
import { useTheme } from "@/lib/theme";

export default function TabsLayout() {
  const { member } = useSupabase();
  const theme = useTheme();
  const showAdmin = member?.is_admin === true;

  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        headerTitle: () => (
          <Image 
            source={require("@/assets/phina_logo.png")} 
            style={{ height: 32, width: 120, resizeMode: "contain" }} 
          />
        ),
        headerStyle: { backgroundColor: theme.background },
        headerShadowVisible: false,
        headerTintColor: theme.primary,
        tabBarShowLabel: false,
        tabBarActiveTintColor: theme.primary,
        tabBarInactiveTintColor: theme.textMuted,
        tabBarStyle: { backgroundColor: theme.surface, borderTopColor: theme.border },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          tabBarIcon: ({ color, size }) => <Ionicons name="calendar-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="cellar"
        options={{
          tabBarIcon: ({ color, size }) => <Ionicons name="wine-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="admin"
        options={{
          tabBarLabel: "Admin",
          tabBarIcon: ({ color, size }) => <Ionicons name="lock-closed-outline" size={size} color={color} />,
          tabBarButton: showAdmin ? undefined : () => null,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          tabBarIcon: ({ color, size }) => <Ionicons name="person-outline" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
