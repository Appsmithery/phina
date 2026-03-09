import { extractGoogleAvatarUrl, shouldSeedGoogleAvatar } from "@/lib/avatar";

describe("avatar helpers", () => {
  it("seeds from user_metadata avatar_url first", () => {
    expect(
      extractGoogleAvatarUrl({
        app_metadata: { provider: "google" },
        user_metadata: {
          avatar_url: "https://example.com/avatar.jpg",
          picture: "https://example.com/picture.jpg",
        },
      } as any)
    ).toBe("https://example.com/avatar.jpg");
  });

  it("falls back to google identity picture metadata", () => {
    expect(
      extractGoogleAvatarUrl({
        app_metadata: {},
        user_metadata: {},
        identities: [
          {
            provider: "google",
            identity_data: {
              picture: "https://example.com/google-picture.jpg",
            },
          },
        ],
      } as any)
    ).toBe("https://example.com/google-picture.jpg");
  });

  it("ignores avatar metadata for non-google users", () => {
    expect(
      extractGoogleAvatarUrl({
        app_metadata: { provider: "email" },
        user_metadata: {
          avatar_url: "https://example.com/avatar.jpg",
        },
      } as any)
    ).toBeNull();
  });

  it("seeds when a member has no avatar and no source", () => {
    expect(shouldSeedGoogleAvatar({ avatar_url: null, avatar_source: null } as any)).toBe(true);
  });

  it("does not overwrite uploaded avatars", () => {
    expect(
      shouldSeedGoogleAvatar({
        avatar_url: "https://example.com/upload.jpg",
        avatar_source: "upload",
      } as any)
    ).toBe(false);
  });

  it("does not reseed after explicit removal", () => {
    expect(shouldSeedGoogleAvatar({ avatar_url: null, avatar_source: "removed" } as any)).toBe(false);
  });
});
