# Smart Android TV Remote — v3.9 production update

Scope: review flow, compact layout sizing, IR blaster reliability, 15 full themes with previews, and a proper diagnostics screen. The Wi-Fi/Xstream connection layer (discovery, 6467 pairing, PIN, certificate storage, 6466 TLS, RemoteMessage) is not touched.

## What I verified first

- Current build is versionName 3.8 / versionCode 45.
- `src/lib/theme.ts` already is a centralised ThemeManager with full light+dark token sets, but only 5 skins exist (graphite, midnight, mint, noir, ocean).
- `RateDialog.tsx` is a custom star popup shown before the Play API — this is the "fake popup" the spec forbids; the review trigger is also gated on a local press counter that can block eligibility.
- `PadSurface.tsx` compact pad is capped at `max-w-[12rem]` with `gap-1.5`, which is what makes buttons too small — a sizing bug, not a scaling bug.
- IR path (`ir-bridge.ts` → `ir-remote.ts` → `IrPlugin.java`) exists and validates patterns, but emits no diagnostics, has no hardware-capability gate in the UI, and no test-transmit path, so failures are silent.
- Ads: banner already disabled, App Open + Interstitial production IDs in `AdsConfig.java` — kept as-is.

## 1. Google Play In-App Review (official API only)

- Delete the custom star dialog (`RateDialog.tsx`) and its trigger; the Play sheet becomes the only rating UI. "Rate this app" in Settings keeps its direct Play Store listing intent (that path is a store link, not a fake review popup).
- Rewrite eligibility in `native-review.ts` as an event-driven state machine: TV connected + 6466 remote session established + ≥3 successful commands + ≥2 successful sessions + not pairing + no error + foreground + no ad on screen. Persist counters; 7-day cooldown after a shown/failed flow; never on first session.
- `ReviewPlugin.java`: log each stage with the exact `[REVIEW] …` tags requested, keep the `ReviewInfo`/`launchReviewFlow` result, and expose it to the web layer via a `status()` method so diagnostics can show whether Google suppressed the sheet or our own code did.
- Debug-only "Test In-App Review" button inside the diagnostics screen (hidden in release builds).

Note: Google decides whether the sheet actually renders. The plan makes the call verifiable, not guaranteed.

## 2. Compact layout button sizing

- Rework `PadSurface.tsx` compact pad: remove the 12rem cap, size keys from available space with a 48dp floor and 52–64dp target for D-pad/OK, cut gaps instead of key size, and give OK a visibly larger centre.
- Audit the surrounding rows in `RemoteApp.tsx` (power/mute, volume/channel, back/home/menu, keyboard/voice) so every listed control keeps a ≥48dp target in portrait and landscape, on small and large phones, with no clipping.
- Keep pressed-state animation and the existing haptics/sound feedback on all of them.
- Classic, Cross, Touch and Compact layouts all stay; selection remains persisted.

## 3. IR blaster

- Add structured `[IR] …` logging on both sides (native + web) covering hardware check, emitter presence, carrier ranges, selected frequency, pattern length, transmit start/finish/failure with exception text.
- Hardware gate: when `hasIrEmitter()` is false the IR sheet shows "IR blaster is not available on this phone." and refuses to claim success.
- Frequency selection uses `getCarrierFrequencies()` and picks the nearest supported carrier before transmitting; `SecurityException` / `IllegalArgumentException` / `RuntimeException` are caught and surfaced.
- Keep transports separate: IR keys never enter the Wi-Fi path and vice-versa.
- IR Diagnostics panel (hardware, ranges, selected carrier, last command, pattern length, result, error) plus a debug-only "Send IR Test" burst.

## 4. Themes — 15 complete skins

- Add 10 full theme definitions to `THEMES` (Arctic Blue, Royal Purple, Crimson Red, Forest Green, Sunset Orange, Cyber Cyan, Rose Pink, Titanium Silver, Space Black, Electric Violet), each with hand-tuned light and dark token sets (background, surface, card, button, buttonPressed, border, divider, primary, secondary, text, icon, input, glow, shadow) — not accent swaps.
- Existing 5 themes stay unchanged. Selected theme keeps persisting and applies instantly.
- Sweep remote components for any literal colour utility and route it through tokens.

## 5. Theme preview cards

Each theme card in Settings renders a miniature remote (background, card, D-pad, OK, secondary keys, accent) drawn with that theme's tokens and the currently selected button style, so the preview matches reality.

## 6. Contrast safety

All 15 themes are checked against Soft Raised / Glass / Flat / Neon Glow. A debug-only contrast validator walks every theme × style pair and reports any text/background or icon/surface pair below the readable threshold.

## 7. Diagnostics screen (debug builds)

Replace the current debug sheet content with sectioned diagnostics: CONNECTION, IR, ADS, REVIEW, APP, plus "Copy diagnostics". The copied text is redacted — no PIN, keys, certificates, tokens, typed text or voice data.

## 8. Ads

Untouched production IDs, no bottom banner, existing App Open + Interstitial behaviour, critical-flow suppression extended so no ad fires immediately before a review request.

## 9. Release

Bump to versionName 3.9 / versionCode 46, same application ID `app.remote.universal`, and deliver a signed ZIP containing the APK and the Play AAB.

## Technical notes

- Files touched: `src/lib/theme.ts`, `src/lib/settings.ts`, `src/lib/native-review.ts`, `src/lib/ir-remote.ts`, `src/lib/ir-bridge.ts`, `src/components/remote/{PadSurface,RemoteApp,SettingsPanel,IrRemoteSheet,DebugSheet}.tsx`, new theme-preview + diagnostics components, `ReviewPlugin.java`, `IrPlugin.java`, `android/app/build.gradle`.
- Not touched: `NativeAndroidTvPlugin.java`, `AtvProto.java`, `AtvTls.java`, `AtvIdentity.java`, `transports.ts` Wi-Fi path, `AdsConfig.java`.
- Debug-only surfaces are gated on the native `BuildConfig.DEBUG` flag exposed through a plugin status call, so release UI never shows them.
