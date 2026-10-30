import { initializeApp } from 'firebase/app'
import { getAuth, initializeAuth, inMemoryPersistence } from 'firebase/auth'
import {
  getDocFromCache,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  runTransaction,
  writeBatch,
} from 'firebase/firestore'

// This config is public by design; access is controlled by firestore.rules
export const firebaseConfig = {
  apiKey: 'AIzaSyC4eOX-0JtICDZQZC1oD6aX39-e97Dyhng',
  authDomain: 'book-mart-22cf5.firebaseapp.com',
  projectId: 'book-mart-22cf5',
  storageBucket: 'book-mart-22cf5.firebasestorage.app',
  messagingSenderId: '74449633274',
  appId: '1:74449633274:web:278ed8b0bee96b43672e43',
}

// The developer / super admin. Must match the email in firestore.rules.
export const ADMIN_EMAIL = 'saadmalikok@gmail.com'

// Staff log in with a username; behind the scenes it becomes username@bookmart.app
export const STAFF_DOMAIN = 'bookmart.app'

export const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)

// Offline-first Firestore: data is cached on the phone, writes queue while offline
export const realDb = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
})

// The database every screen uses. Normally the real shop database; for a trainee it is switched to the
// practice copy on this phone (see lib/training.js). `export let` keeps every import pointing at the current one.
export let db = realDb
export const isTraining = () => db !== realDb
export function setActiveDb(next) {
  db = next
}

/**
 * runTransaction that also works in training mode.
 * The practice copy never talks to a server, so there the same steps are applied straight to the phone copy.
 */
export async function runTx(fn) {
  if (!isTraining()) return runTransaction(db, fn)
  const batch = writeBatch(db)
  const tx = {
    get: async (ref) => {
      try {
        return await getDocFromCache(ref)
      } catch {
        return { id: ref.id, exists: () => false, data: () => undefined }
      }
    },
    set(ref, data, opts) {
      opts ? batch.set(ref, data, opts) : batch.set(ref, data)
      return tx
    },
    update(ref, data) {
      batch.update(ref, data)
      return tx
    },
    delete(ref) {
      batch.delete(ref)
      return tx
    },
  }
  const result = await fn(tx)
  batch.commit().catch(() => {}) // applied on the phone at once; never sent anywhere
  return result
}

// A second Firebase app used only to create staff accounts,
// so creating a user does not log the admin out.
let secondaryAuth = null
export function getSecondaryAuth() {
  if (!secondaryAuth) {
    const secondaryApp = initializeApp(firebaseConfig, 'user-creator')
    secondaryAuth = initializeAuth(secondaryApp, { persistence: inMemoryPersistence })
  }
  return secondaryAuth
}

export function usernameToEmail(input) {
  const v = input.trim().toLowerCase()
  return v.includes('@') ? v : `${v}@${STAFF_DOMAIN}`
}

export function emailToUsername(email = '') {
  return email.endsWith(`@${STAFF_DOMAIN}`) ? email.slice(0, -(STAFF_DOMAIN.length + 1)) : email
}

export const isAdminEmail = (email) => (email || '').toLowerCase() === ADMIN_EMAIL
