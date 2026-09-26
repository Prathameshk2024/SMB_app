# Google Play submission: the policy answers

What the Play Console asks about data and policies, answered from what the
code does. The privacy policy (`frontend/src/legal/`) says the same things in
words a user reads; if one changes, change the other.

**Have a lawyer read the policies before the first public release.** They
were written to match the code and Indian law as of September 2026, not
reviewed by counsel.

## URLs the console asks for

| Field | URL |
|---|---|
| Privacy policy | `https://shantai-mahila-bajar-app-frontend.vercel.app/legal/privacy` |
| Account deletion (Data safety → Data deletion) | `https://shantai-mahila-bajar-app-frontend.vercel.app/delete-account` |
| Terms (optional, store listing) | `https://shantai-mahila-bajar-app-frontend.vercel.app/legal/terms` |

All three are public routes: they open in a browser with no account and no app.

## Data safety form

"Shared" in Play's sense means handed to a third party for *their* use.
Service providers processing on our behalf (Google Cloud/Firebase, Cloudinary,
Vercel, MSG91) do not count, and neither does a transfer the user starts
(a buyer's address reaching the seller she ordered from). So nothing below is
"shared".

| Play category | Data type | Collected | Why (Play's purposes) | Optional? |
|---|---|---|---|---|
| Personal info | Name | Yes | App functionality, Account management | Required |
| Personal info | Phone number | Yes | Account management (OTP), App functionality | Required |
| Personal info | Address | Yes (buyers' delivery addresses; sellers' village, taluka, district, pincode) | App functionality | Required |
| Personal info | Other info | Yes (seller age, education, SHG, business details, FSSAI number, readiness answers) | App functionality, Analytics (programme impact, aggregated) | Mostly optional |
| Financial info | User payment info | Yes (seller's UPI ID and QR image) | App functionality | Required for sellers |
| Financial info | Purchase history | Yes (orders) | App functionality | Required |
| Financial info | Other financial info | Yes (UTR numbers, ₹50 payment screenshots) | App functionality, Fraud prevention | Required to pay |
| Photos and videos | Photos | Yes (product photos, QR, payment screenshots, chosen from gallery) | App functionality | Required for sellers |
| App activity | Other user-generated content | Yes (reviews, reports, complaints) | App functionality | Optional (rating is required to reorder) |
| App info and performance | — | No | | |
| Device or other IDs | Device or other IDs | Yes (FCM push token, on the session) | App functionality (notifications) | Optional (permission) |
| Location | — | No (a pincode or address is Personal info, not Location) | | |
| Audio | Voice recordings | No: the mic uses the phone's speech service; the recording goes to Google, never to us | | |
| Contacts, Calendar, Messages, Health, Files, Web history | — | No | | |

Security practices:

- **Data is encrypted in transit:** Yes (HTTPS everywhere).
- **Users can request deletion:** Yes, in the app (My Profile → Delete my
  account) and at the deletion URL above.
- **What is kept after deletion** (disclosed in the privacy policy): past
  orders without the buyer's identity, the ₹50 payment ledger, complaints
  without contact details, and backup copies until they roll over.

## Other declarations

- **Developer:** a personal Play account with the developer name **Team Zenith**,
  registered to Sampanna Rajesh Nampalli, publishing for the college. The
  privacy policy's "Who we are" section (`frontend/src/legal/en.ts`, `mr.ts`)
  names both, because Play expects the policy to name the developer on the
  listing. Change one, change the other.
- **Package name:** `in.shantai.mahilabazar`, fixed at the first upload.
- **Reviewer login:** the MSG91 widget's Demo Credentials number, `9579642050`,
  which is sent no SMS. It is exempt from the three-a-day send ceiling
  (`SEND_LIMIT_EXEMPT` in `backend/src/auth/rateLimit.ts`); change both if the
  number changes.
- **Target audience:** 18 and over. Not designed for children.
- **Ads:** None.
- **User-generated content:** Reviews. In-app reporting exists (Report on
  every listing and review, `POST /reports`), admins can hide reviews, and the
  terms forbid abusive content.
- **Permissions:** see `docs/DEPLOY.md` §6 *Permissions*. Remove the unused
  ones before submitting; `CAMERA` is the one that stays declared on purpose.

## Before submitting: things the policy promises that need checking

- **Backups.** The privacy policy says deleted data stays in a backup "for a
  limited time until it is replaced". Backup Firestore A holds only the
  latest copy, which is true of it. But `docs/BACKUP.md` says the local
  database files keep the first of each month *for good*, and the backup
  Cloudinary keeps *every photo ever copied*. Both keep erased people for
  ever. Either prune them (e.g. drop monthly files after a year, delete from
  the backup Cloudinary what the live one no longer has), or change the
  policy's wording to say how long they really last.
- **Rejected ₹50 refunds.** The seller agreement promises the money back
  within 7 working days (`FEE_REFUND_WORKING_DAYS` in
  `frontend/src/legal/operator.ts`). The app does not move money, so this is
  a promise the admin desk keeps by hand.
