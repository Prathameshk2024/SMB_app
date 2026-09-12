import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { SEED_DEMO_DATA, usingFirestore } from '../config.js'
import { type Db, emptyDb, seed, withDefaults } from './seed.js'
import { loadAll, persistDiff, seedInto } from './firestore.js'

/**
 * Persistence.
 *
 * Two drivers behind one synchronous interface, chosen by whether Firebase
 * credentials are present:
 *
 *   Firestore   when FIREBASE_* is configured
 *   JSON file   otherwise, so the app still runs with no accounts at all
 *
 * `getDb()` stays synchronous in both cases — the whole dataset lives in
 * memory and writes go through in the background. See firestore.ts for why,
 * and for the single-instance limitation that comes with it.
 */

const here = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR = path.resolve(here, '../../data')
const DB_FILE = path.join(DATA_DIR, 'db.json')

// Empty until initStore() runs. Not the demo seed: a route that fires before
// boot finishes should find nothing, not three invented sellers.
let db: Db = emptyDb()
let ready = false

/**
 * Starts as `usingFirestore`, but drops to false if the connection cannot be
 * established at boot — an expired gcloud login, a missing key, no network.
 *
 * Reads and writes must agree on this. Leaving writes pointed at Firestore
 * after reads had fallen back would drop every change on the floor: the
 * per-write catch below would log and continue, and nothing would reach the
 * JSON file either.
 */
let firestoreLive = usingFirestore

/* ------------------------------------------------------------------ */
/* JSON file driver                                                    */
/* ------------------------------------------------------------------ */

function loadFile(): Db {
  try {
    if (fs.existsSync(DB_FILE)) {
      // withDefaults, because a file written before `customers` existed would
      // otherwise hand every route an undefined collection.
      return withDefaults(JSON.parse(fs.readFileSync(DB_FILE, 'utf8')) as Partial<Db>)
    }
  } catch (err) {
    console.warn('[db] could not read db.json, reseeding:', (err as Error).message)
  }
  // Same rule as the Firestore path: no stored data does not mean invent some.
  const fresh = SEED_DEMO_DATA ? seed() : emptyDb()
  writeFile(fresh)
  return fresh
}

function writeFile(next: Db): void {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true })
    fs.writeFileSync(DB_FILE, JSON.stringify(next, null, 2), 'utf8')
  } catch (err) {
    console.error('[db] write failed:', (err as Error).message)
  }
}

/* ------------------------------------------------------------------ */
/* Boot                                                                */
/* ------------------------------------------------------------------ */

/** Must be awaited before the server starts listening. */
export async function initStore(): Promise<void> {
  if (firestoreLive) {
    try {
      const loaded = await loadAll()
      if (loaded) {
        db = loaded
        console.log('[firestore] loaded', summarise(db))
      } else if (SEED_DEMO_DATA) {
        // Explicitly asked for: a brand-new project gets the demo data so the
        // app is immediately usable and the collections exist to browse.
        db = seed()
        await seedInto(db)
        console.log('[firestore] seeded demo data (SEED_DEMO_DATA is on)')
      } else {
        // The default. An empty database stays empty - inventing sellers in
        // front of real customers is worse than an empty catalogue.
        db = emptyDb()
        console.log('[firestore] database is empty - set SEED_DEMO_DATA=true to load demo data')
      }
    } catch (err) {
      // Bad credentials should not take the whole server down. Carry on
      // against the JSON file, but say so plainly - a silent downgrade would
      // have someone wondering why the Firebase console stays empty.
      firestoreLive = false
      console.error('[firestore] connection failed:', (err as Error).message)
      console.error('[firestore] falling back to backend/data/db.json - writes will NOT reach Firestore')
      db = loadFile()
    }
  } else {
    db = loadFile()
  }
  ready = true
}

function summarise(d: Db): string {
  return `${d.sellers.length} sellers · ${d.products.length} products · ${d.orders.length} orders`
}

export function getDb(): Db {
  if (!ready) {
    // A route ran before initStore() finished. Better a loud error here than
    // silently serving seed data over a real database.
    console.warn('[db] getDb() called before initStore() completed')
  }
  return db
}

/* ------------------------------------------------------------------ */
/* Writes                                                              */
/* ------------------------------------------------------------------ */

let pendingWrite: NodeJS.Timeout | null = null
let writing = false
let writeAgain = false

/**
 * Schedule a persist. Coalesced over 400ms: placing an order touches several
 * documents in quick succession and they should cost one batch, not five.
 */
export function save(): void {
  if (!firestoreLive) {
    writeFile(db)
    return
  }
  if (pendingWrite) clearTimeout(pendingWrite)
  pendingWrite = setTimeout(() => void flush(), 400)
}

export async function flush(): Promise<void> {
  if (!firestoreLive) {
    writeFile(db)
    return
  }
  if (writing) {
    // A write landed while one was in flight; run once more after it.
    writeAgain = true
    return
  }
  writing = true
  try {
    const { written, deleted, refused } = await persistDiff(db)
    if (written || deleted) {
      console.log(`[firestore] wrote ${written}, deleted ${deleted}`)
    }
    if (refused) {
      // Loud, and every time - a refusal means memory and the server now
      // disagree, and the reason for that disagreement is still unfixed.
      console.error(
        `[firestore] ${refused} deletion(s) refused by the bulk-delete guard. ` +
          'Something emptied a collection in memory; find it before trusting this process.',
      )
    }
  } catch (err) {
    console.error('[firestore] persist failed:', (err as Error).message)
  } finally {
    writing = false
    if (writeAgain) {
      writeAgain = false
      await flush()
    }
  }
}

export function resetDb(): Db {
  // The dev-reset endpoint. It respects the same switch, so hitting it against
  // a real database wipes it back to empty rather than filling it with demo
  // sellers that customers would then see.
  db = SEED_DEMO_DATA ? seed() : emptyDb()
  save()
  return db
}

// Lives in ids.ts to keep seed -> customers -> store from becoming a cycle.
// Re-exported so the 30-odd existing `import { newId } from './store.js'` call
// sites keep working.
export { newId } from './ids.js'
