# Building the APK (no Android Studio required)

The web app you see in the preview runs in a browser, where Android blocks the
IR emitter and Bluetooth HID keys. The installable Android app removes those
limits. Everything needed is already in this repo.

## Option A — GitHub cloud build (recommended)

1. Connect this project to GitHub (Lovable → GitHub → Connect).
2. Open your repo → **Actions** tab → **Build Android APK** → **Run workflow**.
3. Wait ~5 minutes. Open the finished run and download the
   **universal-tv-remote-apk** artifact.
4. Unzip it, copy `app-debug.apk` to your phone, and install it
   (allow "Install unknown apps" for your file manager or browser).

The workflow also runs automatically on every push to `main`.

## Option B — build locally

Requires JDK 21 and the Android SDK on your machine:

```bash
bun install
bun run sync:android
cd android && ./gradlew assembleDebug
# APK: android/app/build/outputs/apk/debug/app-debug.apk
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
