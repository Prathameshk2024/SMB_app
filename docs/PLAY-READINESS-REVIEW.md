# Google Play readiness review — Shantai Mahila Bazar

First review 26 September 2026 · updated 27 September 2026. The online copy (claude.ai artifact) stopped being updated on 26 September; this file is the current one.

## Where things stand

**Not ready to submit yet.** The native Android side passes: target API 36, 16 KB page size, permissions. What remains is web-app work, plus the ₹50 decision, which is deliberately **the last step** in the work order below.

What was checked:

- **Web app, API and shared rules**, in `Shantai_mahila_bajar_app` (branch `prathamesh2`), since the APK loads the live website.
- **Android wrapper**, in `SMB_Android_App/Android_app` (branch `sub-main`): `app.json`, the manifest, the Gradle files and `app/index.tsx`.
- **The release APK built on 26 September 2026**: the merged manifest, zip alignment, and the page alignment of all 30 native libraries.
- **Current Google Play policies**: Payments, User Generated Content, Data safety, account deletion, App access, target API and Misrepresentation.

Each finding names the file and line it came from.

### Done so far

| What | State |
| --- | --- |
| Staff can close an account for someone who can't sign in (deletion without the app) | Committed (`c48dd96`). Needs deploying. |
| Raw IP on the seller account-close event replaced by a hashed one | Committed with the above. Needs deploying. |
| Package name `in.shantai.mahilabazar` | Wrapper changed (uncommitted); release build compiles; registered in Firebase, and both `google-services.json` copies list it. |
| Developer name "Team Zenith", registered to Sampanna Rajesh Nampalli, named in the privacy policy (both languages) | Uncommitted. Needs deploying. |
| MSG91 Demo Credentials for reviewers, number `9579642050` | Set up in MSG91 and tested end to end on the live site. |
| Demo number exempt from the 3-codes-a-day send limit (`SEND_LIMIT_EXEMPT`) | Uncommitted, with a test. Needs deploying. |

## Work order

Work through these in order. Each step points to its details further down. The **₹50 comes last**, as agreed.

- [ ] **1. Commit what is done:** in this repo the rate-limit exemption, policy text and docs; in the wrapper the package rename and `google-services.json`.
- [ ] **2. Before the first upload:** create the upload keystore. See *Settle before the first upload*.
- [ ] **3. Reviewer access (B1):** build the two demo safeguards, then prepare the production data. See *App access*.
- [ ] **4. Remaining blockers:** B3 (reporting and blocking), B4 (a deleted buyer's orders come back) and B5 (deletion page names the app). See *Blockers*.
- [ ] **5. Privacy policy and Data safety fixes.** See that section.
- [ ] **6. Should fix:** misleading claims, shop details, health claims, wrapper hardening, contact details. See *Should fix*.
- [ ] **7. Minor issues.** See *Minor*.
- [ ] **8. Deploy:** the API to Cloud Run when nobody is ordering, then the frontend and admin on Vercel. Re-test the demo login.
- [ ] **9. The ₹50 fee (B2), last:** decide between A, B and C, then build it. See *The ₹50 fee*.
- [ ] **10. Build the .aab, upload it to closed testing, and run the 12-tester, 14-day test.** Then apply for production.

**One risk in this order.** Uploads to closed testing are reviewed too. A closed-testing build that still shows the in-app ₹50 payment could be flagged under the Payments policy before step 9 is done. If you want the 14-day clock running early, the lowest-risk way is to finish step 9 first, since option A is small. Otherwise accept that the first closed-test review may raise it.

## Blockers: likely rejection or suspension

B2, the ₹50 fee, is in its own section at the end, to match the work order.

| # | Issue | Play policy | Evidence | Fix |
| --- | --- | --- | --- | --- |
| B1 | Reviewers cannot sign in | App access | **Mostly solved:** MSG91 Demo Credentials work, and the demo number skips the send limit. **Still open:** a new seller can do nothing until she pays ₹50 and an admin approves it (`sellers.routes.ts:227`), and nothing keeps the demo account away from real sellers and buyers. | Build the two safeguards and prepare the demo data. See *App access*. |
| B3 | User-generated content reporting is incomplete | User Generated Content | Buyers cannot report the reviews they read: `Browse.tsx:396` renders `ReviewList` without `reportable`. Nobody can report a shop or a buyer: `REPORT_TARGETS = ['product','review']` (`shared/src/report.ts:28`). There is no way to block a buyer, and closing her account is not a ban. `docs/PLAY-STORE.md` claims "Report on every listing and review". | Pass `reportable` on product pages. Add `seller` and `customer` report targets, with "Report this shop" on the shop page and a report option on the seller's order screen. Add an admin block for buyers, keyed on the phone. The staff close (`POST /admin/customers/close`) is not a ban: she can sign up again with the same number. Correct PLAY-STORE.md. |
| B4 | A deleted buyer gets her orders back when she signs in again | Account deletion, User Data | The buyer id is `c-<phone>` (`backend/src/db/customers.ts:24`). `closeCustomer` keeps `customerId` on her orders and reviews (`backend/src/db/accountClose.ts:194-209`). `/orders/mine` looks orders up by that id (`orders.routes.ts:31`). The privacy policy (`legal/en.ts:138`) and the delete page say her phone number is removed. | In `closeCustomer`, replace `customerId` on her orders, reviews and reports with a random tombstone id. Add a test that her digits appear nowhere afterwards. The staff close for buyers (`adminCloseCustomer`) calls the same function, so it is fixed at the same time. |
| B5 | The public deletion page never names the app | Account deletion | `screens/landing/DeleteAccount.tsx:27` shows the logo only, with empty alt text. The body never says "Shantai Mahila Bazar" or the college. Play requires the app or developer name as on the store listing. | Add a heading line with the app name "Shantai Mahila Bazar" and `OPERATOR.nameEn` / `nameMr`. The app name satisfies the rule on its own. |

## Settle before the first upload

These cannot be changed once an .aab is uploaded, or they block publishing.

1. **Package name: `in.shantai.mahilabazar`. Done; commit it.**
   - Changed in the wrapper: `app.json`, `android/app/build.gradle` (namespace and applicationId), the manifest's deep-link scheme, and the two Kotlin files, now under `java/in/shantai/mahilabazar/`.
   - `in` is a Kotlin keyword, so those files declare ``package `in`.shantai.mahilabazar``. The applicationId needs no escaping; Amazon India's app id is `in.amazon.mShop.android.shopping`.
   - Also renamed: `scheme` is now `shantaimahilabazar` and `slug` is `shantai-mahila-bazar`.
   - Registered in the `shantaimahilabajar` Firebase project; both `google-services.json` copies list the new package. The backend needs no change, because push goes through the same project.
   - The APK built on 27 September used a temporary Firebase entry and must not be shipped. Build a fresh one.
   - `docs/DEPLOY.md` and the wrapper's `ANDROID-WRAPPER-HANDOFF.md` are updated.
2. **Upload keystore: to do.** It does not exist yet. Without it the release build falls back to the debug key, which Play refuses.
   - Create it with the `keytool` command in the wrapper's README.
   - Put the four `SMB_UPLOAD_*` values in `~/.gradle/gradle.properties`.
   - Back up the `.jks` and its passwords somewhere other than this machine.
3. **Developer account: personal, developer name "Team Zenith". Done.**
   - Registered to Sampanna Rajesh Nampalli. The privacy policy's "Who we are" section names both, in both languages, so it matches the listing (`frontend/src/legal/en.ts`, `mr.ts`). The name stays in Latin script in the Marathi text, exactly as registered with Google. `POLICY_VERSION` is unchanged, because what people agreed to about their data has not changed.
   - `docs/PLAY-STORE.md` records the developer name; keep it and the policy in step.
   - **Closed test first:** a personal account created after November 2023 must run a closed test with at least 12 testers, opted in for 14 days in a row, before it can apply for production.
4. **Build as an .aab:** `cd android && ./gradlew bundleRelease`. Keep `versionCode 1` for the first upload and raise it for every one after.

## App access: reviewer login

### Setup: done

- **MSG91 Demo Credentials** are set for `9579642050`. No SMS is sent to it, and the fixed OTP verifies it ([MSG91 guide](https://msg91.com/help/sendotp/how-to-integrate-the-new-login-with-otp-widget)).
- **Tested on 27 September:** a demo login is accepted end to end, including our API's check of the widget's token with MSG91 (`otp.providers.ts`). No server-side bypass is needed.
- One number covers both sides: the role is chosen at sign-in (`backend/src/routes/auth.routes.ts:134`).
- The OTP is kept out of this repo and goes only in the Play Console's App access form.
- **Change the OTP to a random 6-digit code.** A guessable one like `123456` lets anyone into the demo shop and buyer account, and reviewers read the code from the form anyway.
- **Send limit:** `SEND_LIMIT_EXEMPT` in `backend/src/auth/rateLimit.ts` holds `9579642050`, and `/auth/otp/send` skips the 3-a-day per-number limit for it alone. The verify limits and every per-IP limit still apply. `backend/tests/auth-hardening.test.ts` checks it is the only exempt number.

### Code still needed

1. **Keep the demo away from real people:**
   - Hide the demo shop from the public catalogue (`catalog.routes.ts:28`), except for the demo number's own buyer session.
   - Refuse orders from the demo buyer to any real seller (`orders.routes.ts:141`).
2. **Tests**, then deploy the API and redeploy the frontend on Vercel.

### Production data to prepare

- [ ] Sign in with the demo number as a seller and register the shop, named "Demo shop (Play review)".
- [ ] Grant it one pack: `npx tsx backend/scripts/admin.ts grant <phone> 1`, or use the console.
- [ ] Give it a UPI ID and QR code, and add 2 or 3 products with photos. Approve them (`approve-product <id>`).
- [ ] Sign in with the same number as a buyer and give a name.
- [ ] Place orders from that buyer to the demo shop: one left as placed, one accepted, one delivered and rated. An unrated delivered order blocks the buyer app.
- [ ] Set a reminder 5 months out to renew the demo shop, because a granted pack never extends the end date.
- [ ] Write a reset runbook in `docs/PLAY-STORE.md` for when a reviewer deletes an account.

### Draft text for Play Console → App access

Choose "All or some functionality is restricted". One set of credentials covers both sides.

**Phone** `9579642050`, **OTP** `<fixed OTP set in MSG91>`. No SMS is sent to this number.

**As a buyer:**

1. The app opens in Marathi; tap "English" at the top.
2. Tap "I want to buy". Enter the 10 digits without +91, tap Send OTP, and enter the code above.
3. Order only from "Demo shop (Play review)". Every other shop belongs to a real woman entrepreneur.
4. At checkout, use pincode `413xxx` (delivery is limited to Maharashtra) and Cash on Delivery.
5. To delete the account: My Profile → Delete my account → type the last 4 digits of the number. The app refuses while an order is open, so cancel the placed order first.
6. Web deletion page: `https://shantai-mahila-bajar-app-frontend.vercel.app/delete-account`.

**As a seller:**

1. Log out, then tap "I want to sell" and sign in with the same number and code.
2. The shop is already approved and active.
3. Try:
   - My Business
   - Orders: accept, pack, and confirm a UPI payment
   - My Products: a new product goes to staff review before it appears
   - Reviews
   - Profile → Delete my account: the shop closes at once, and data is erased after 7 days
4. The admin console is a separate internal website and is not part of this app.

## Privacy policy and Data safety form vs the code

Play treats an inaccurate privacy policy or Data safety form as a policy violation, even after approval. Each row is a promise the code does not keep yet.

| Area | What is promised | What the code does | Fix |
| --- | --- | --- | --- |
| Closed seller's listings | Her photos are erased (`legal/en.ts:137`, delete page `del.*`) | `scrubSeller()` never touches `db.products`, so her listings, their Cloudinary photos and the ingredients stay (`backend/src/db/accountClose.ts:98-148`) | Destroy her product images and remove or tombstone the listings, respecting `isBulkDelete`. Otherwise disclose that they are kept. |
| Complaints | Kept "without contact details" (`en.ts:141`, `PLAY-STORE.md:53`) | Name and phone are copied onto each complaint (`complaints.routes.ts:43-53`) and never scrubbed | Blank `name` and `phone` and tombstone `byUserId` on account close |
| Other fields left behind | Erased | `order.landmark`, `seller.fssai`, `seller.shopSlug` (built from her shop name) and `closeNote` survive. Review text is kept, but the policy mentions only stars and name. | Add them to the scrub and to `SELLER_PII_FIELDS`. Say in the policy that review text stays. |
| Backups | Kept "for a limited time" (`en.ts:144`) | Monthly database files are kept for good and the backup Cloudinary keeps every photo (`docs/BACKUP.md:32-34`). The delete page does not mention backups. | Prune (for example, monthly files dropped after 12 months) and state the real period, on the delete page too |
| Raw IP addresses | Only scrambled (hashed) IPs are kept (`en.ts:51`) | Fixed in `c48dd96`: the seller account-close event now hashes the IP. Rows written before the fix may still hold raw IPs. | Deploy, then scrub existing `authEvents` rows with `detail: 'account.close'` once |
| Hosting logs | Not mentioned | Cloud Run and Vercel keep request logs with IP and browser details (30 days by default) | One sentence in the policy with the retention period |
| Service providers | Google Cloud, Firebase, Cloudinary, Vercel, MSG91 (`en.ts:116-126`) | GitHub Actions reads the whole live database every night for backups (`.github/workflows/backup.yml:26`) | Add GitHub to the provider list |
| Data safety form | `docs/PLAY-STORE.md:29-44` | Also collected: account ids (Personal info → User IDs), and app activity measured for the readiness score (`shared/src/readiness.ts:96-107`) | Declare User IDs and App interactions (Analytics) |
| Age 18+ | Target audience 18 and over | Age is optional for sellers and never asked of buyers; the consent tick does not mention age | Add "and I am 18 or older" to both consent lines |
| Security log retention | Deleted after 90 days | The prune runs only when a new event is written (`backend/src/auth/events.ts:60`) | Add `pruneAuthEvents` to the 15-minute housekeeping timer |
| ₹50 payer UPI ID | Not listed (`en.ts:70`) | `payerUpi` is stored (`sellers.routes.ts:601`) | Add "the UPI ID you paid from". Revisit after the ₹50 decision. |

Everything else on the form checked out; see *Checked and passing*.

`docs/DEPLOY.md:471-473` still lists location and `SYSTEM_ALERT_WINDOW` permissions as "to remove". The release manifest has none of them, so the table is out of date. Correct it so nobody declares location on the Data safety form by mistake.

## Should fix before submitting

### Untrue or misleading claims in the app

The landing page is the first screen a reviewer sees in the APK. Deceptive claims fall under the Misrepresentation policy.

| String key | Says | Reality | Fix |
| --- | --- | --- | --- |
| `lp.w4b` (`i18n/strings.ts:201`, `:1026`) | "An OTP on every delivery" | Delivery OTP is legacy; nothing reads it (`shared/src/types.ts:92-96`) | Remove |
| `lp.wl3` (`:208`, `:1033`) | "Every screen can be read aloud" | There is no read-aloud feature | Remove, or say voice typing |
| `wait.canDoMeanwhile` (`:1154`) | "Watch the training videos" | There are no videos, only walkthrough tours | Say the tours |
| `wait.title` (`:327`, `:1149`) | "We have received your payment" | Shown before anyone has checked the payment | "Your details have been sent" |
| `lp.w1b` (`:198`, `:1025`) | "Every item made by a woman in the village herself" | Nothing checks this | Soften the wording |
| Seller agreement (`legal/en.ts:413` + Marathi) | Buyers can see her FSSAI number | FSSAI is stored on the seller and never shown publicly | Show it on the seller card, or change the sentence |

`lp.wl4` ("Just 50 rupees for 5 products") moved to the ₹50 section, because its fix depends on that decision.

### Shop details go public without any check

- A seller can change her shop name, `about` text, photo and UPI QR image at any time (`backend/src/routes/sellers.routes.ts:319-323`).
- `photo` and `upiQrUrl` accept any URL at all, and both reach buyers through `publicSeller()`.
- **Fix:** accept only this Cloudinary account's folders, as `screenshotProblem()` does for payment screenshots. Make shop details reportable (B3), or queue changes for an admin.

### Health claims and restricted products

- The category "सौंदर्य व आरोग्य / Beauty & Wellness" (`backend/src/db/seed.ts:78`) invites cure claims. Rename it "Beauty & Personal care".
- The terms ban medicines but not health claims (`legal/en.ts:310`). Add: no claims that a product treats, cures or prevents a disease, and no supplements or ayurvedic medicines.
- The server never checks `categoryId` against the category list (`products.routes.ts:25`). Validate it.
- Admin approval of every listing before it goes live already reduces this risk.

### Android wrapper (`app/index.tsx`, manifest)

These need a new APK, so do them before building the .aab in step 10.

- `mixedContentMode="always"`: change to `"never"`. The site is HTTPS only.
- Any https link to another site opens inside the app with no way out but Back. Open addresses outside the site in the phone's browser instead (`onShouldStartLoadWithRequest`).
- `android:allowBackup="true"` lets Android back up the WebView's storage, including the login token, to Google Drive and restore it on another phone. Set it to `false`.
- Declaring `CAMERA` and `RECORD_AUDIO` makes Play treat a camera and a microphone as required, which hides the app from devices without them. Add `<uses-feature android:name="android.hardware.camera" android:required="false"/>`, and the same for `android.hardware.microphone`.
- Remove `console.log('Intercepted URL…')` and the other logging from release builds.
- The loading spinner is blue (`#2196F3`); use the brand colour.

### Contact details

- The support contact is a professor's personal mobile and Gmail (`legal/operator.ts:25-26`). Use a college email address and desk number if you can.
- Buyers have no Help or contact card in My Profile; only sellers do.

## Minor

- **Hard-coded English "Network error"** in the Marathi app, on about 10 screens: `CustomerRegister.tsx:72`, `SellerRegister.tsx:223`, `CartCheckout.tsx:362,409,688`, `EditProduct.tsx:187`, `EditProfile.tsx:124`, `PaymentQr.tsx:74`, `Subscription.tsx:147`, `UploadProduct.tsx:247`. About 16 backend errors have no `messageMr`.
- **A browser `confirm()` pop-up** when a buyer deletes an address (`CartCheckout.tsx:1036`). In a WebView it shows the site's address. Use `ConfirmSheet`.
- **`/college.jpg` is missing** from `frontend/public/`, so the landing page gets a 404 on every visit (`CollegeCard.tsx:30`).
- **Nothing stops `SEED_DEMO_DATA` in production** (`backend/src/config.ts:215`). The demo sellers use real-looking phone numbers.
- **The seller's QR preview** encodes a real, payable ₹100 (`PaymentQr.tsx:140`). Use a QR code with no amount.
- **Forced ratings:** the buyer app is blocked until every delivered order is rated. Not a policy breach, but it weakens the "genuine reviews" claim. Consider a skip option.

"Registration fee" title and the waiting screen's "today" label moved to the ₹50 section, because both are on the payment screens that the decision may change.

## Checked and passing

| Area | Result |
| --- | --- |
| Target API level | `targetSdkVersion 36` in the merged release manifest. This meets the API 36 requirement for new apps from 31 August 2026. |
| 16 KB page size | All 30 native libraries in the release APK have 16 KB LOAD alignment (`llvm-readelf`), and `zipalign -c -P 16` passes. |
| Permissions | Declared: `CAMERA` (never requested, keeps the photo picker to the gallery), `INTERNET`, `POST_NOTIFICATIONS`, `RECORD_AUDIO` and `VIBRATE`. Libraries merge in only normal-level ones (network state, boot, wake lock, FCM, launcher badges, install referrer). None of storage, photos/media, location, SMS, contacts, exact alarm, advertising ID or all-apps query is present, so no declaration form is needed. |
| Notification prompt | Asked after sign-in, not at launch; a refusal is shown to the user with a button to open settings. |
| Account deletion | Both roles, in the app (My Profile) and on the public `/delete-account` page, apart from B4 and B5. |
| Deletion without the app | Staff can close an account on a request by phone, WhatsApp or email (`c48dd96`, not yet deployed). A seller is closed from her page in the admin console, a buyer by phone number from the Complaints screen, and the same can be done with `npm run admin -- close-seller\|close-customer`. The server requires the channel, a tick that staff rang the registered number back, and for a seller the last 4 digits of her number. A staff close does exactly what her own button does, including the 7-day window for a seller and the refusal while an order is open. It is logged with the staff member's name and a hashed IP. |
| Privacy policy in the app | Reachable from My Profile (Policies) for both roles, from the sign-in screen, the consent boxes and the landing footer. |
| Privacy policy names the developer | "Team Zenith", registered to Sampanna Rajesh Nampalli, in both languages (uncommitted). |
| Terms before user content | Consent is required and recorded at seller registration and at the buyer's name screen. The terms define content that is not allowed. |
| Listing moderation | No listing goes live without admin approval (`initialListingStatus()`). Admins can hide reviews and block sellers. |
| Third-party code | No analytics, tracking, ads, crash reporting or web fonts. The only outside script is the MSG91 login widget. |
| Sensitive data | No location, contacts, SMS, clipboard reads, caste, religion, date of birth or bank account numbers. Voice typing uses the phone's speech service and never reaches our server. |
| Encryption in transit | HTTPS everywhere in production. |
| Misrepresentation | No claims of government affiliation and no bank, UPI or payment-app logos. The college is named as the operator throughout. |
| Demo mode | The server refuses to start in production with on-screen OTP codes. |
| Buyer payments | Paid to the seller for physical goods, after she accepts the order. This is exempt from Play Billing, the same as food delivery or rides. |

## The ₹50 fee (B2): last step

| Issue | Play policy | Evidence |
| --- | --- | --- |
| The ₹50 seller fee is paid inside the app, not through Play Billing | Payments | The fee buys 5 listing slots and 6 months of shop visibility (`shared/src/seller.ts:14`). A QR code, the UPI ID and the ₹50 price appear on about 8 seller screens (`screens/seller/Subscription.tsx`, `MyProducts.tsx:157`, `UploadProduct.tsx:104`, `SubscriptionNotice.tsx:26`, landing `lp.wl4`). Play lists "app functionality" and "subscription services" as needing Play Billing. India allows alternative billing only alongside Play Billing, and Google still charges a fee. |

A link from the app to a web payment page, with the UTR entered back in the app, does **not** avoid this: Play's policy names in-app "links" and "user interface flows, including account creation or sign-up flows" that lead to another way to pay. A payment link sent from outside the app, by SMS, WhatsApp or a coordinator, is not covered by those rules.

### Options

| Option | What changes | Effort | Risk |
| --- | --- | --- | --- |
| A. No payment inside the APK | Inside the APK, the seller's screens show her slots and end date but no price, QR code or payment steps. She pays a coordinator or the college desk, or on the website in her phone's browser, possibly from a link sent by SMS or WhatsApp. Staff record payments made outside the app with a new "Record payment" form; website payments keep today's queue. | About half a day of coding plus review, testing and deploy: 1–2 days on the calendar. No new APK. | Low |
| B. Google Play Billing | The flow below | About 1.5–2 days of coding; 4–5 working days on the calendar at best, up to two weeks, because of Google's payments-profile verification, API access and test rounds on a Play-installed copy | Low |
| C. Submit unchanged | Nothing | None | High: rejection or a later suspension |

### Option A in detail

- **The seller:** registers, sees "Your shop is waiting to be activated by the programme office", pays outside the app, and her shop turns on when staff record it. Renewal and extra slots work the same way. The app shows status lines ("Your shop's term ends on 12 March", "All 5 of your slots are in use") with no price and no pay button.
- **Staff:** a "Record payment" form on the seller's page in the admin console, with the kind (first pack, extra pack, renewal), how it was paid (cash, UPI to the college, other), the date and an optional UTR. It uses the same approval code as an app payment, so renewals extend the six months. The existing grant-slots button can't do this: it never extends a term (`admin.routes.ts:262-266`).
- **Code:**
  - An `isInApk()` check (`window.ReactNativeWebView`, already used by `pushBridge.ts`).
  - The price and pay entry points hidden inside the APK.
  - A route to record an outside payment, with tests.
  - The admin form.
  - The seller agreement's fee section.
- **Judgement calls:**
  - The status wording is chosen not to steer users to another way to pay, but Play has no official "safe" wording.
  - The terms, readable in the app, still describe the ₹50 fee.

### Option B in detail: Google Play Billing

**What the seller sees.** She taps "Pay ₹50" and Google's own payment sheet slides up over the app. She pays with UPI (Google Pay, PhonePe and other UPI apps), a card, Play balance or a gift card, using the Google account on her phone. Her slots or new end date appear within seconds. There is no QR code, screenshot, UTR or waiting for an admin.

1. **Play Console:**
   - A payments profile for the personal account. Google pays out to the account holder's own bank account, not the college's.
   - A **prepaid** 6-month subscription base plan at ₹50, with no automatic charge; she tops it up when reminded.
   - A one-time consumable "5 more slots" at ₹50.
   - License testers.
2. **Android wrapper (a new APK):**
   - The Play Billing Library through `react-native-iap` or `expo-iap`.
   - Bridged like push: the page posts `{ type: 'billing:buy', productId }`, and the wrapper opens Google's sheet with her seller id as the obfuscated account id.
   - The purchase token comes back to the page through `window.__smbPurchase(...)`.
3. **API:**
   - `POST /sellers/me/play-purchase` verifies each purchase with the Play Developer API through a service account.
   - It checks the account id is her own and refuses a token used twice.
   - It applies the same effect as an approved payment (`backend/src/db/subscription.ts`).
   - It acknowledges the purchase within 3 days (Google refunds anything unacknowledged) and consumes the slot pack.
   - Real-time developer notifications over Pub/Sub report refunds so the slots or term can be taken back.
4. **Screens and text:**
   - The Play button replaces the payment screens in the APK.
   - Nothing in the APK may mention paying the college by UPI.
   - The seller agreement's fee and refund sections are rewritten.
   - The Data safety form and privacy policy are updated.

**Money:**
- Google keeps a service fee, usually 15% for a small developer, so about ₹42.50 of each ₹50 arrives. Check with a tax adviser how GST applies.
- Payouts go monthly to the account holder's personal bank account.
- A seller who pays a coordinator in cash can't use it, so the "Record payment" form from option A is still useful.

### Items that wait for this decision

- `lp.wl4` (`i18n/strings.ts:209`, `:1034`): "Just 50 rupees for 5 products" omits the 6 months. Under option A it is hidden in the APK; under B the price comes from Google.
- **"Registration fee" title** (`pay.title`) is also used when buying a second pack.
- **The waiting screen labels the submit time "today"** even on other days (`Subscription.tsx`).
- The privacy policy's list of ₹50 payment data (`payerUpi`, screenshots) depends on which payment route stays.

## Sources

- [Google Play Payments policy](https://support.google.com/googleplay/android-developer/answer/9858738): the digital goods that need Play Billing, the exemptions for physical goods and services, and the ban on in-app links and flows to other payment methods.
- [Changes to Google Play's billing requirements for developers serving users in India](https://support.google.com/googleplay/android-developer/answer/13306652?hl=en): alternative billing only alongside Play Billing, with the fee reduced by 4%.
- [Expanded billing choice and lower fees on Google Play](https://android-developers.googleblog.com/2026/06/play-expanded-billing.html) (June 2026): covers the US, EEA and UK only; India is not included.
- [Meet Google Play's target API level requirement](https://developer.android.com/google/play/requirements/target-sdk): API 36 for new apps and updates from 31 August 2026.
- [MSG91: how to integrate the Login with OTP widget](https://msg91.com/help/sendotp/how-to-integrate-the-new-login-with-otp-widget): Demo Credentials, a fixed number and OTP for app review, with no SMS sent.
- Code: `Shantai_mahila_bajar_app` at commit `c48dd96` plus uncommitted changes; wrapper `SMB_android` branch `sub-main` at `8c9449c` plus the uncommitted package rename; release APK built on 26 September 2026.
