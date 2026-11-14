# Google Play listing materials

Drafts for the first Google Play release of KA Nails
(`com.ka_nails_miami.app`) from the Gorgona One AI account. Nothing here has
been entered or uploaded in Play Console.

| File                                    | Play Console field                                           |
| --------------------------------------- | ------------------------------------------------------------ |
| `listing-en-US.md`                      | Main store listing: name, short and full description, others |
| `listing-ru-RU.md`                      | Russian translation of the listing                           |
| `graphics/icon-512.png`                 | App icon: 512x512, 32-bit PNG                                |
| `graphics/feature-graphic-1024x500.png` | Feature graphic: 1024x500, 24-bit PNG                        |
| `screenshots/en-US/*.jpg`               | Phone screenshots, English: five, 1080x1920                  |
| `screenshots/ru-RU/*.jpg`               | Phone screenshots, Russian: five, 1080x1920                  |
| `app-content-answers.md`                | App content: Data safety, content rating, target audience    |

## Sources and rules

- Texts use only facts from `content/studio-facts.json` and what the app shows.
  The brand is plain "KA Nails"; the studio is pedicure only. No address, hours
  or location are given, because `studio-facts.json` has none yet.
- The texts give no prices, so a price change does not make the listing wrong.
  A change of services, add-ons or the master does: check both listings then.
- Graphics come from `node android/tools/make-store-graphics.mjs` (run from the
  repository root). It resizes the original logo, which is never edited, and
  three portfolio works, like the site's link preview.

## Screenshots

Taken on 2026-11-13 from the release build of commit `b9c7a32`, signed with the
debug key and built with `NEXT_PUBLIC_SITE_URL=https://ka-nails-miami.com`, on
the KANails36 emulator. Order: services, Hammam menu, gallery, work viewer,
contact.

The emulator screen is 1080x2400. Play accepts no side longer than twice the
other, so the screen was set to 1080x1920 for the shots and reset afterwards,
with the system UI demo mode for a clean status bar:

```sh
adb shell wm size 1080x1920
adb shell settings put global sysui_demo_allowed 1
adb shell am broadcast -a com.android.systemui.demo -e command enter
adb shell am broadcast -a com.android.systemui.demo -e command clock -e hhmm 1000
adb shell am broadcast -a com.android.systemui.demo -e command battery -e level 100 -e plugged false
adb shell am broadcast -a com.android.systemui.demo -e command network -e mobile hide
adb shell am broadcast -a com.android.systemui.demo -e command network -e wifi show -e level 4 -e fully true
adb shell am broadcast -a com.android.systemui.demo -e command notifications -e visible false
# take the shots: adb exec-out screencap -p > shot.png
adb shell am broadcast -a com.android.systemui.demo -e command exit
adb shell settings put global sysui_demo_allowed 0
adb shell wm size reset
```

## Owner decisions

Decided on 2026-11-14:

1. **Privacy policy** goes on the site as `/privacy/` and `/ru/privacy/` on
   `ka-nails-miami.com`, through a separate site PR. It should cover the app
   (no data collected, only the chosen language stored) and the website the app
   opens (the chat and the WhatsApp booking request). The pages do not exist
   yet; Play needs the URL before review.
2. **Launch straight to production**, although the site's `/book/` still says
   "Online booking is not available yet" and offers a request via WhatsApp.
3. **Contact email**: the contact address of the Gorgona One AI developer
   account.
4. **Countries**: the United States only.

Decided earlier: `ka-nails-miami.com` serves the site (PR #24), and the release
build links to it.

Still open:

- Whether to show the studio phone on the listing.
- The Data safety reading of the website chat; see `app-content-answers.md`.
- Release signing (upload key, Play App Signing) and every save or upload in
  Play Console, each only after the owner's explicit yes.
