import { supabase } from "@/lib/supabase";

export async function deleteCurrentAccount() {
  const { data, error } = await supabase.functions.invoke("delete-account", {
    body: { confirm: true },
  });

  if (error) {
    const message =
      data && typeof data === "object" && "error" in data && typeof data.error === "string"
        ? data.error
        : error.message;
    throw new Error(message || "Could not delete your account.");
  }

  return data;
}
