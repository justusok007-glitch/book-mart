// Training mode — a practice copy of the shop that lives only on this phone.
//
// How "zero effect on the real data" is guaranteed (three separate locks):
//  1. The practice copy is a separate Firestore instance in a separate Firebase app with a made-up project id,
//     pointed at a dead local address (127.0.0.1:1) and with its network switched off. It cannot reach Google.
//  2. Screens use `db` from lib/firebase.js; for a trainee it is swapped to this copy before any screen loads.
//     Auth / profile / role always use `realDb` (read only for a trainee).
//  3. firestore.rules: a role marked `training: true` gets NO write permission anywhere in the real database
//     (can() is false for trainees); trainees may only READ what is needed to make the copy.
//
// The copy is filled from the real shop (items, stock, prices, costs, customers, suppliers, settings, staff names).
// Reset = throw the copy away and copy the real shop again.

import { deleteApp, initializeApp } from 'firebase/app'
import {
  clearIndexedDbPersistence,
  collection,
  connectFirestoreEmulator,
  disableNetwork,
  doc,
  getDocsFromCache,
  getDocsFromServer,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  terminate,
  writeBatch,
} from 'firebase/firestore'
import { realDb } from './firebase'

// collections copied from the real shop into the practice copy
export const SEED_COLLECTIONS = ['settings', 'users', 'categories', 'items', 'variants', 'barcodes', 'itemCosts', 'customers', 'suppliers', 'counters']

const SANDBOX = { apiKey: 'practice-only', projectId: 'book-mart-practice-sandbox', appId: '1:0:web:practice' }

const store = {
  get: (k) => {
    try {
      return localStorage.getItem(k)
    } catch {
      return null
    }
  },
  set: (k, v) => {
    try {
      localStorage.setItem(k, v)
    } catch {
      /* ignore */
    }
  },
}

let current = null // { uid, gen, app, db }

function genOf(uid) {
  return Number(store.get(`bm-training-gen-${uid}`)) || 1
}

async function open(uid, gen) {
  const app = initializeApp(SANDBOX, `practice-${uid}-${gen}`)
  const pdb = initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) })
  // lock 1: no way out — dead local address, network off
  connectFirestoreEmulator(pdb, '127.0.0.1', 1)
  await disableNetwork(pdb)
  return { uid, gen, app, db: pdb }
}

/** Copy the real shop into the practice copy (needs internet once). Returns the number of records copied. */
async function seed(pdb, onProgress) {
  let n = 0
  let i = 0
  for (const name of SEED_COLLECTIONS) {
    let snap = null
    const ref = collection(realDb, name)
    try {
      // fresh from the shop; if the line is slow, use what this phone already has
      snap = await Promise.race([getDocsFromServer(ref), new Promise((_, no) => setTimeout(() => no(new Error('slow')), 15000))])
    } catch (e) {
      if (e?.code === 'permission-denied') snap = null // this trainee may not read it — skip
      else snap = await getDocsFromCache(ref).catch(() => null)
    }
    if (snap) {
      const docs = snap.docs
      for (let j = 0; j < docs.length; j += 400) {
        const batch = writeBatch(pdb)
        for (const d of docs.slice(j, j + 400)) batch.set(doc(pdb, name, d.id), d.data())
        batch.commit().catch(() => {}) // applied on the phone at once; never sent anywhere
      }
      n += docs.length
    }
    onProgress?.(++i / SEED_COLLECTIONS.length)
  }
  return n
}

export function trainingInfo(uid) {
  const gen = genOf(uid)
  const at = Number(store.get(`bm-training-seeded-${uid}-${gen}`)) || null
  return { gen, seededAt: at }
}

/** Open (and if needed fill) this trainee's practice copy. */
export async function openTraining(uid, onProgress) {
  const gen = genOf(uid)
  if (current && current.uid === uid && current.gen === gen) return current.db
  if (current) await closeTraining()
  current = await open(uid, gen)
  const key = `bm-training-seeded-${uid}-${gen}`
  if (!store.get(key)) {
    if (!navigator.onLine) throw new Error('needs-internet')
    const copied = await seed(current.db, onProgress)
    if (!copied) throw new Error('nothing-copied')
    store.set(key, String(Date.now()))
  }
  return current.db
}

export async function closeTraining() {
  if (!current) return
  const c = current
  current = null
  try {
    await terminate(c.db)
    await deleteApp(c.app)
  } catch {
    /* ignore */
  }
}

/** Throw away the practice copy and start again from the real shop. */
export async function resetTraining(uid, onProgress) {
  const old = current && current.uid === uid ? current : await open(uid, genOf(uid))
  current = null
  try {
    await terminate(old.db)
    await clearIndexedDbPersistence(old.db)
    await deleteApp(old.app)
  } catch {
    /* old copy could not be wiped; a new one is used anyway */
  }
  store.set(`bm-training-gen-${uid}`, String(old.gen + 1))
  return openTraining(uid, onProgress)
}
