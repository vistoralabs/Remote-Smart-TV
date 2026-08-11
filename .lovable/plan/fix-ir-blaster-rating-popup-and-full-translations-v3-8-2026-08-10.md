# Fix IR blaster, rating popup, and full translations (v3.8)

Three confirmed problems, one release.

## 1. Rating popup never appears

Cause found in the code: the popup counter (`noteUsageForReview`) is only called inside the Wi-Fi key handler in `RemoteApp.tsx`, and that handler returns early with "Not connected" before counting when no TV is linked. So users who use IR only, or who never connect a TV, never reach the threshold.

Fix:
- Count usage on every meaningful interaction: Wi-Fi key press, IR button press, IR auto-search success, sheet opens.
- Show the star popup after 5 interactions, and again after 30 if dismissed (existing retry logic kept).
- Also show it once on the 2nd app launch if the user has never rated, so it appears even with light usage.
- Keep the current behaviour of the Settings "Rate this app" button (already working) and reuse the same code path.

## 2. IR blaster not controlling appliances

The catalogue and native transmit path exist, but several practical issues remain:
- The `Ir` plugin is registered twice (two separate modules), which logs a duplicate-registration warning; consolidate into one bridge module.
- Most appliances ignore a single frame. Send the frame with proper repeats (NEC 3 frames with correct gaps, Sony 3 frames, AC raw bursts once) and a trailing gap so the pattern is terminated correctly.
- Add an IR diagnostics block inside the IR sheet: emitter present or not, device model, supported carrier ranges, last pattern length and frequency, and the exact error text if the transmit is rejected. Without this we cannot tell "no emitter" from "wrong code" on your phone.
- Improve brand/remote selection flow so the chosen appliance + brand + remote number is remembered and the on-screen keys show only the buttons that remote actually has (already partly there, will be verified end to end).
- Keep the CC0 catalogue coverage as-is (TV 113, AC 92, Fan 121, Audio 99, STB 59, Projector 52, DVD 28 brands) and keep "Universal auto-search" for finding the working remote.

## 3. Language change only translates a few words

Cause: the translation dictionary has ~40 keys, while most on-screen text (IR sheet, rating popup, device sheet, settings section titles, toasts, onboarding details, button labels) is hardcoded English.

Fix:
- Expand the dictionary to cover every visible string in the app: header, device sheet, settings (all sections and option descriptions), IR sheet (categories, brand list, auto-search, diagnostics), keyboard/voice sheet, rating popup, onboarding, and all toast messages.
- Replace the hardcoded strings in those components with dictionary lookups.
- Translate the full set for all 8 languages (English, Hindi, Spanish, French, Portuguese, Arabic, Bengali, Persian), keeping RTL layout for Arabic/Persian.
- Appliance brand names and remote numbers stay untranslated (they are product names).

## Not changing

Theme system, colours, layout, remote design, Xstream Wi-Fi discovery/pairing/6466 protocol, and AdMob setup stay exactly as they are.

## Technical notes

- Single IR bridge module exporting `irEmitterAvailable`, `irCarrierRanges`, `sendIrKey`; `native-ir.ts` legacy duplicate removed or re-exported from it.
- `ir-protocols.ts`: add repeat-frame builders and trailing gap; keep raw `CapturedIrBurst` passthrough for AC.
- `IrPlugin.java`: report carrier ranges and return the concrete `IllegalArgumentException` message so the UI can display it.
- Version bump to 3.8 (versionCode 45) in `android/app/build.gradle` and `APP_VERSION`.
- Build signed release and deliver a single ZIP with APK + AAB.
