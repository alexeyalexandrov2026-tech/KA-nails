# KA Nails for Android

A native client app (Kotlin, Jetpack Compose) that shows the KA Nails services,
prices, portfolio and contacts in English and Russian. The catalog opens
offline. Booking and the AI chat open the live site in a Chrome Custom Tab; the
app itself makes no network calls and has no `INTERNET` permission.

## One source of truth

Nothing about the studio is maintained here. Before every build,
`tools/build-catalog.mjs` compiles the site's own modules with the repository's
TypeScript and writes the catalog into generated assets:

- services, add-ons, menu notes, contacts and the master from
  `content/studio-facts.json` through `lib/studio-facts.ts` (prices formatted by
  its `priceText`, so "from" and "+" match the site);
- the 19 works from `getGalleryItems("en" | "ru")` in `lib/gallery-data.ts`,
  with their WebP thumbnails and medium images from `public/photos/`;
- copy from `lib/locales/{en,ru}.ts` and the site address from `lib/site.ts`;
- the launcher icon from `public/icons/icon-192.png`.

Edit the site, rebuild the app. Unit tests compare the generated catalog with
`content/studio-facts.json` and check every packaged image.

Booking opens `/book/` or `/ru/book/`; a portfolio photo adds the site's
existing `?look=work-NN`. The chat opens the home page (`/` or `/ru/`), where
the site's assistant lives.

## Build and check

Needs Node.js 24 with `npm ci --ignore-scripts` run in the repository root,
JDK 17 and the Android SDK (platform 37). `node` must be on `PATH`, or set
`KA_NODE` or the Gradle property `ka.node`.

```powershell
$env:JAVA_HOME = 'C:/Users/alexa/android-toolchain/jdk-17.0.21+9'
$env:ANDROID_HOME = 'C:/Users/alexa/android-toolchain/sdk'
.\gradlew.bat --max-workers=2 :app:testDebugUnitTest :app:lintDebug :app:assembleDebug
$env:ANDROID_SERIAL = 'emulator-5568'
.\gradlew.bat --max-workers=2 :app:connectedDebugAndroidTest
```

The debug APK is `app/build/outputs/apk/debug/app-debug.apk`.

CI (the `android` job in `.github/workflows/ci.yml`) runs the same unit tests,
lint and both builds on every push, and keeps the debug APK for 14 days as the
artifact `ka-nails-android-debug-<commit>`.

Judge start-up speed on a release build: release uses R8, and a debug build
spends several times longer composing its first frame. To try a release build
on an emulator without release keys, sign it locally with the debug key:

```powershell
.\gradlew.bat :app:assembleRelease "-Pandroid.injected.signing.store.file=$env:USERPROFILE\.android\debug.keystore" `
  -Pandroid.injected.signing.store.password=android `
  -Pandroid.injected.signing.key.alias=androiddebugkey -Pandroid.injected.signing.key.password=android
```

`connectedDebugAndroidTest` uninstalls the app when it finishes; install the
APK again before checking by hand.

## Not decided yet

- The application ID `com.kanails.app` is a placeholder until the owner
  confirms it; it cannot change after the first Play upload.
- Headings use the system serif: the site's Cormorant Garamond ships only as
  WOFF2, which Android cannot load.
- Release signing, the Play Console listing, the data safety form and
  publishing belong to a separate release.
