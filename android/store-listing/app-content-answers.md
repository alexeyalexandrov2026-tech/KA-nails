# Play Console App content: draft answers

Draft answers for Policy and programs > App content, checked against the code
of commit `b9c7a32`. Nothing here has been entered in Play Console. Check each
answer against the app again before submitting.

## What the answers rest on

- The merged release manifest requests no `INTERNET` permission and no
  `com.google.android.gms.permission.AD_ID`. Its only `uses-permission` is
  `com.ka_nails_miami.app.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION`, which
  AndroidX adds for its own receivers.
- The app stores one value, the chosen language, in `SharedPreferences`
  (`MainActivity.kt`). `data_extraction_rules.xml` and `allowBackup="false"`
  keep it out of cloud backup and device transfer.
- No SDKs for analytics, crash reporting, ads or sign-in.
- Booking and the chat open the KA Nails website in a Chrome Custom Tab, that
  is, in the user's browser. Phone and WhatsApp links hand off to the dialer and
  WhatsApp. The app sends nothing itself.

## Data safety

| Question                                                            | Draft answer                 |
| ------------------------------------------------------------------- | ---------------------------- |
| Does your app collect or share any of the required user data types? | No                           |
| Is all user data collected by your app encrypted in transit?        | Not asked: nothing collected |
| Can users request that their data be deleted?                       | Not asked: nothing collected |

Result on the store page: "No data collected" and "No data shared with third
parties".

Open point for the owner: the website the Custom Tab opens has a chat that
sends messages to the KA Nails chat service. The answer "No" treats the Custom
Tab as the user's browser, outside the app, which is how Android describes
Custom Tabs. If the owner wants the more cautious reading, declare "Messages:
other in-app messages" and "Personal info: name, phone number" as collected,
for the purpose "App functionality", not shared, encrypted in transit. The
privacy policy should describe the website's chat either way.

## Content rating (IARC questionnaire)

| Question                                                                 | Draft answer                                                         |
| ------------------------------------------------------------------------ | -------------------------------------------------------------------- |
| Category                                                                 | All other app types                                                  |
| Violence, fear, sexuality, language, controlled substances, crude humour | No to all                                                            |
| Gambling or simulated gambling                                           | No                                                                   |
| Users can interact or exchange content with each other                   | No                                                                   |
| Shares the user's current physical location with others                  | No                                                                   |
| Allows purchases of digital goods                                        | No                                                                   |
| Unrestricted internet access, for example a browser                      | No: only pages of the KA Nails website, opened in the system browser |

Expected result: Everyone (ESRB), PEGI 3, USK 0. The portfolio shows feet with
pedicure work only.

## Other declarations

| Section                        | Draft answer                                                             |
| ------------------------------ | ------------------------------------------------------------------------ |
| Privacy policy                 | Owner decision, see `README.md`; required for every app                  |
| App access                     | All functionality is available without special access                    |
| Ads                            | No, the app contains no ads                                              |
| Advertising ID                 | No, the app does not use the advertising ID                              |
| Target audience                | 18 and over; the app is not designed to appeal to children               |
| News app                       | No                                                                       |
| Health apps                    | No health features: pedicure menu and portfolio only                     |
| Financial features             | None                                                                     |
| Government app                 | No                                                                       |
| Data deletion                  | Not applicable: no accounts                                              |
| Price and in-app purchases     | Free, no in-app purchases                                                |
| Countries                      | Owner decision; the studio's prices are in US dollars                    |
| Android developer verification | Check whether `com.ka_nails_miami.app` must be registered before release |
