# Building the APK & App Bundle (AAB)

The web app preview runs in a browser where Android limits hardware access to the IR blaster and Bluetooth HID keys. The native Android build (`.apk` and `.aab`) unlocks full hardware control.

## Option A — GitHub Cloud Build (Recommended & Automated)

1. Push your changes to GitHub (or open your connected GitHub repo).
2. Go to **Actions** tab → **Build Android APK** → click **Run workflow**.
3. After ~3–5 minutes, open the completed run and download **`remote-smart-tv-apk-and-aab`**.
4. The downloaded ZIP archive contains:
   - **`app-debug.apk` / `app-release.apk`** — Install directly on your Android phone to test.
   - **`app-release.aab`** — Google Play Store App Bundle for store publishing.

## Option B — Build Locally

Requires JDK 21 and the Android SDK:

```bash
# 1. Build WebView bundle & sync to Android project
npm run build:mobile
npx cap sync android

# 2. Compile APK and AAB
cd android
./gradlew assembleDebug bundleDebug assembleRelease bundleRelease

# Outputs:
# APK: android/app/build/outputs/apk/debug/app-debug.apk
# AAB: android/app/build/outputs/bundle/release/app-release.aab
```

## What the native app unlocks

| Transport | Browser | Installed APK |
| --- | --- | --- |
| Wi-Fi (Roku / TCL Roku) | yes | yes |
| Wi-Fi (LG webOS, Samsung, Sony) | no — blocked websocket / pairing token | needs the brand handshake (next step) |
| Bluetooth | pairing only | pairing; HID keys need the HID profile |
| IR blaster | never | yes — works offline on any TV brand |

The IR path is implemented end to end: `IrPlugin.java` drives Android's
`ConsumerIrManager`, and `src/lib/native-ir.ts` holds the NEC code tables for
Samsung, LG, Sony, Hisense and TCL.

Note: your phone must actually have an IR emitter. Many recent phones
(including most OnePlus Nord models) do not — the app will say so on the
IR card if the hardware is missing.
