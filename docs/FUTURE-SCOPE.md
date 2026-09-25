# Future scope

Work that has been decided on but deliberately left for later. Each item says
why it matters and what "done" looks like, so whoever picks it up does not
have to rediscover either. Delete an item when it is done — git keeps the
history.

## Give the backup a read-only Firebase key

*Added 25 September 2026.*

The nightly backup (`.github/workflows/backup.yml`) reads the live Firestore
with `LIVE_FIREBASE_SERVICE_ACCOUNT`, which is the same full-access key Cloud
Run uses. The backup never writes to the live project — it reads a fixed list
of collections by name — so a leaked Actions secret should be able to read
the database at most, not change or delete it.

1. In the Google Cloud Console, on the **live** project: IAM & Admin →
   Service Accounts → create `backup-reader` with exactly one role,
   **Cloud Datastore Viewer** (`roles/datastore.viewer`).

   ```bash
   gcloud iam service-accounts create backup-reader --project=LIVE_PROJECT_ID
   gcloud projects add-iam-policy-binding LIVE_PROJECT_ID \
     --member="serviceAccount:backup-reader@LIVE_PROJECT_ID.iam.gserviceaccount.com" \
     --role="roles/datastore.viewer"
   ```

2. Keys → Add key → JSON. Keep the file out of the repository.
3. GitHub → Settings → Secrets and variables → Actions → replace
   `LIVE_FIREBASE_SERVICE_ACCOUNT` with the file's contents (raw JSON or
   base64 JSON; `config.ts` reads either). Then delete the local file.
4. Actions → Backup → Run workflow with **dry_run** ticked. It should print
   `firestore read N documents` with the usual N; `PERMISSION_DENIED` means
   the role went on the wrong project. Then one real run.

**Do not delete the old key** — it is Cloud Run's, in Secret Manager.

Done also means:

- The note in `docs/BACKUP.md` that says the backup uses Cloud Run's key is
  rewritten to describe the read-only account.
- Decide whether to rotate Cloud Run's key: it sat in GitHub and was handed
  to Actions runners until now. Rotating is new key → new Secret Manager
  version → redeploy → delete the old key.
- `LIVE_CLOUDINARY_API_KEY` / `_SECRET` in the same workflow are also the
  live account's full keys. If the Cloudinary plan allows a key with
  restricted permissions, the same reasoning applies.

## Delivery charge by distance, set by the seller

*Added 25 September 2026.*

A seller has one flat `deliveryFee` (and `freeDeliveryAbove`), and no screen
asks her for either — so almost every order carries 0, which the cart shows
as "ask the seller" (see *One seller per cart* in `CLAUDE.md`). The buyer
learns the real charge only on a phone call after ordering.

Give the seller the option of charges by distance: for example ₹20 up to
5 km, ₹40 up to 10 km, ₹60 up to 20 km — bands she chooses. The checkout
then works out the charge for the buyer's address and shows

> **total = item price + delivery charge**

before the order is placed, and the order stores that figure in
`deliveryFee` / `total` exactly as today (`orders.routes.ts`, where the fee is
chosen now).

To settle before building it:

- **Where the distance comes from.** Nothing in the app has a location today —
  only pincodes. The cheapest honest answer is the distance between the
  centres of the seller's and the buyer's pincodes, from a bundled
  Maharashtra pincode table; asking for GPS adds a permission prompt and a
  wrong-location problem. Say on screen that the figure is approximate.
- **It stays optional.** A seller who sets no bands keeps today's behaviour,
  and 0 still means "ask the seller", never "free".
- **Beyond her last band.** Her pincode list is a hint, not a gate (*Where an
  order may go*), so an address past the last band should fall back to "ask
  the seller" rather than refuse the order.
- **`freeDeliveryAbove` still wins** when the order meets it — that is her
  promise.
- The server computes the charge; the client's figure is only a preview.
- Editing the bands follows the design rules: one page, not a wizard, and a
  Marathi label for every field (`docs/MARATHI-STYLE.md`).

## Move Firebase to Blaze, with a budget alert

*Added 25 September 2026.*

The live project is on the free **Spark** plan, where a daily limit is a hard
stop, not a bill: past 50,000 reads or 20,000 writes a day, Firestore refuses
requests until the reset. Because the server reads every document at each
start, reads grow with *documents × server starts*, and changes waiting on a
spent write limit exist only in memory — a deploy or an idle shutdown before
the reset loses them. `docs/CAPACITY.md` §4 and §10 have the numbers;
§4 *The ways out* names this as the cheapest fix.

Blaze keeps the same daily free allowance, so at today's volume it costs
nothing; past it, reads are about $0.06 per 100,000. Going over becomes a
small bill instead of an outage, and managed backups and point-in-time
recovery become available.

1. Firebase console → the **live** project → Usage and billing → Modify plan
   → **Blaze**, and attach a billing account.
2. Google Cloud console → Billing → **Budgets & alerts** → a budget on that
   project, e.g. ₹500 a month, with email alerts at 50%, 90% and 100%.
   A budget **alerts, it does not cap** — spending carries on past it — so
   the emails must go to someone who reads them.
3. Update the docs that assume Spark: `docs/CAPACITY.md` (§1 table, §4, §9's
   "act at 25,000 reads"), `docs/BACKUP.md` (the opening paragraph, and
   whether to turn on managed backups / point-in-time recovery alongside the
   GitHub Actions copy), and `docs/DEPLOY.md`'s "not on a day the Spark
   limits are spent".

The backup project can stay on Spark.
