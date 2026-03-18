import { Redirect, useLocalSearchParams } from "expo-router";

export default function SignInRedirectScreen() {
  const params = useLocalSearchParams<{ email?: string }>();
  const email = typeof params.email === "string" ? params.email : undefined;

  return <Redirect href={{ pathname: "/(auth)", params: { ...(email ? { email } : {}), mode: "sign-in" } }} />;
}
