# DropDay automatic updates

DropDay includes the Expo Updates client. When a compatible over-the-air (OTA) update is published, the installed app checks when launched, downloads it and applies it on restart. Settings → App updates offers a manual check and restart button.

**One-time setup required before producing an OTA-enabled APK:**
1. In an Expo account you control, create/link the DropDay project (e.g. `npx eas-cli init`); note its real project UUID. Do not paste an invented ID.
2. Set GitHub repository **Settings → Secrets and variables → Actions → Variables → New repository variable** named `EXPO_UPDATES_PROJECT_ID` to that project UUID. This variable is not a secret.
3. Rebuild the Android APK using the GitHub Actions workflow on `release-radar-v1`, and install that OTA-enabled APK **once**.
4. For later JavaScript/asset updates, from a checkout connected to the same Expo project, run `npx eas-cli update --channel production --message "DropDay update"`. Log into the correct Expo account interactively or supply an `EXPO_TOKEN` secret in the publishing environment. Never commit tokens.
5. Version/runtime compatibility: the config uses `runtimeVersion: { policy: 'appVersion' }` and channel `production`. Updating Android native modules or permissions still requires a fresh APK, and bumping `expo.version` changes the runtime version. Do not bump app version for pure OTA changes unless preparing a compatible new APK.

If the variable is absent, the workflow still builds an APK, but remote OTA updates **are disabled**. The Settings UI reports that state. A GitHub Actions APK artifact by itself is *not* an Expo Updates server.

OTA updates do not deliver code natively outside the configured compatible runtime. They require internet access, proper Expo account/project access, and successful publishing. Only publish trusted code.
