import type { User } from "@supabase/supabase-js";
import type { Member } from "@/types/database";

type IdentityLike = {
  provider?: string | null;
  identity_data?: {
    avatar_url?: string | null;
    picture?: string | null;
  } | null;
} | null;

type UserWithOptionalIdentities = Pick<User, "app_metadata" | "user_metadata"> & {
  identities?: IdentityLike[] | null;
};

export function extractGoogleAvatarUrl(user: UserWithOptionalIdentities | null | undefined): string | null {
  if (!user) return null;

  const identities = Array.isArray(user.identities) ? user.identities : [];
  const providers = Array.isArray(user.app_metadata?.providers)
    ? user.app_metadata.providers.filter((provider): provider is string => typeof provider === "string")
    : [];
  const isGoogleUser =
    user.app_metadata?.provider === "google" ||
    providers.includes("google") ||
    identities.some((identity) => identity?.provider === "google");
  if (!isGoogleUser) return null;

  const directAvatar = normalizeAvatarUrl(user.user_metadata?.avatar_url);
  if (directAvatar) return directAvatar;

  const directPicture = normalizeAvatarUrl(user.user_metadata?.picture);
  if (directPicture) return directPicture;

  const googleIdentity = identities.find((identity) => identity?.provider === "google");
  if (!googleIdentity?.identity_data) return null;

  return (
    normalizeAvatarUrl(googleIdentity.identity_data.avatar_url) ??
    normalizeAvatarUrl(googleIdentity.identity_data.picture) ??
    null
  );
}

export function shouldSeedGoogleAvatar(member: Pick<Member, "avatar_url" | "avatar_source"> | null | undefined): boolean {
  if (!member) return true;
  if (member.avatar_url) return false;
  return member.avatar_source == null;
}

function normalizeAvatarUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}
