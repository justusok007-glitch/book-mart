import { initializeApp } from 'firebase/app'
import { getAuth, initializeAuth, inMemoryPersistence } from 'firebase/auth'
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
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
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
})

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
