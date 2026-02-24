# Development build (native push and full native features)

For day-to-day JS and web development you can use **Expo Go** or the **web** target. For **remote push notifications** and other native-only features on a physical device or simulator, use a **development build** instead of Expo Go.

## Why use a development build?

- **Remote push notifications** are **not** supported in Expo Go (removed in SDK 53). To test “Start rating round” → push to members on a real device, you need a development build. See [Expo: development builds](https://docs.expo.dev/develop/development-builds/introduction/).
- Development builds use your app’s real icon, name, and native config; Expo Go is a generic playground and cannot change native capabilities after install.

## How to run a development build

1. **Install** (already in this repo): `expo-dev-client` is installed. With it, `npx expo start` will target the dev build when one is installed (QR/open in dev client instead of Expo Go).

2. **Build the native app** (choose one):
   - **Local:**  
     `npx expo run:ios` or `npx expo run:android`  
     First run will prebuild and build. Use `--device` for a physical device (e.g. `npx expo run:ios --device`).
   - **EAS:**  
     `eas build --profile development --platform ios` (or `android`). Install the built binary on your device, then start JS with `npx expo start` and open the app (dev build), not Expo Go.

3. **Start the bundler**  
   `npx expo start`  
   If you already built and installed the dev client, the QR code / “open” will use that build. Otherwise it will offer Expo Go.

## SecureStore warning (non-blocking)

You may see: *“Value being stored in SecureStore is larger than 2048 bytes and it may not be stored successfully.”*

This is a known limitation. You can ignore it for now; auth and push registration still work. A future change may reduce what is stored in SecureStore to stay under the limit.

## Summary

| Goal                         | Use                    |
|-----------------------------|------------------------|
| Web / PWA development       | `npx expo start` → `w` |
| Quick native UI in Expo Go  | `npx expo start` → scan with Expo Go |
| **Native push notifications**| Development build (`npx expo run:ios` / `run:android` or EAS dev build) |
