# Final rating and universal IR reliability update

## Scope
Keep the existing TV connection layer, themes, and visual design unchanged. Fix the two reported failures: rating actions that do nothing, and the very limited/non-working IR catalog.

## Rating and review flow
- Add Android 11–16 package-visibility declarations for the Play Store (`market://` and `com.android.vending`).
- Make **Rate this app** deterministic: first request the official Google Play In-App Review sheet; if Google does not display it (Google controls this), immediately open the app’s exact Play Store listing instead.
- Trigger the app’s own rating prompt after 5 successful remote key presses, without permanently suppressing it when the native/store action fails.
- Return explicit success/failure from the native plugin and show a clear message if no Play Store handler exists, with an HTTPS listing fallback.

## IR database and transmission
- Replace the current two-brand AC source with the CC0-licensed Flipper-IRDB catalog: currently 96 AC brands / 158 profiles, plus broader TV, set-top box, audio, DVD, projector, fan, and appliance profiles.
- Import both parsed signals and exact raw pulse timings so stateful AC codes are transmitted as recorded rather than incorrectly approximated as simple NEC commands.
- Preserve multiple profiles per brand/model and expose them as Remote 1, Remote 2, etc.; normalize key names to the existing remote UI.
- Add native validation for carrier frequency, timing count, pulse limits, and `ConsumerIrManager` availability; report “no IR emitter” separately from “signal sent.”
- Improve auto-search by cycling only valid power signals, with visible progress and a stop/confirm flow.
- Add attribution/license metadata for the open catalog. Do not copy the attached APK’s proprietary encrypted Kookong database or native SDK; it is useful for behavioral analysis but cannot be reliably or legally transplanted.

## Verification and release
- Add checks for rating fallback behavior, catalog/category counts, raw/parsed signal conversion, and representative NEC/NECext/RC5/Sony/Panasonic/JVC transmissions.
- Verify the unchanged Xstream Wi-Fi remote path and existing settings/theme behavior.
- Increase version to 3.7 / versionCode 44, build a signed release APK and Play Store AAB, and deliver both in one ZIP.

## Technical limits
- The app can only send IR on phones whose Android firmware exposes `ConsumerIrManager`; an IR-looking sensor is not always a transmitter.
- No honest implementation can guarantee every model under every brand: manufacturers reuse brand names with different protocols, and AC remotes often send the complete operating state. The update will provide all profiles in the verified open catalog and multiple model choices, rather than claiming unsupported codes work.
- Official Google In-App Review is intentionally quota-controlled and may show no dialog. The direct Play Store fallback will ensure the Settings action never remains a dead button.
