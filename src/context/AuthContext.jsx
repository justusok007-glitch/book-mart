import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth'
import { collection, doc, getDoc, getDocs, onSnapshot, serverTimestamp, setDoc, writeBatch } from 'firebase/firestore'
import { auth, db, isAdminEmail, usernameToEmail } from '../lib/firebase'
import { ADMIN_ONLY, DEFAULT_ROLES } from '../lib/permissions'
import { nextLetter } from '../lib/saleMath'

export const AuthContext = createContext(null)

// First time the developer admin logs in: create the admin profile and the default roles.
// Every user gets a fixed receipt letter (A, B, C…) for their receipt series A00001, A00002…
export async function assignReceiptLetters() {
  const snap = await getDocs(collection(db, 'users'))
  const users = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
  const used = users.map((u) => u.receiptLetter).filter(Boolean)
  // admin first, then staff in the order they were added
  const missing = users
    .filter((u) => !u.receiptLetter)
    .sort((a, b) => (a.roleId === 'admin' ? -1 : b.roleId === 'admin' ? 1 : (a.createdAt?.toMillis?.() ?? 0) - (b.createdAt?.toMillis?.() ?? 0)))
  if (!missing.length) return
  const batch = writeBatch(db)
  for (const u of missing) {
    const letter = nextLetter(used)
    used.push(letter)
    batch.update(doc(db, 'users', u.id), { receiptLetter: letter })
  }
  await batch.commit()
}

async function bootstrapAdmin(u) {
  try {
    const ref = doc(db, 'users', u.uid)
    const snap = await getDoc(ref)
    if (!snap.exists()) {
      await setDoc(ref, {
        name: 'Admin',
        username: u.email,
        email: u.email,
        roleId: 'admin',
        active: true,
        createdAt: serverTimestamp(),
      })
    }
    const meta = await getDoc(doc(db, 'meta', 'setup'))
    if (!meta.exists()) {
      const batch = writeBatch(db)
      for (const [id, role] of Object.entries(DEFAULT_ROLES)) {
        batch.set(doc(db, 'roles', id), { ...role, createdAt: serverTimestamp() })
      }
      batch.set(doc(db, 'meta', 'setup'), { rolesSeeded: true, at: serverTimestamp() })
      await batch.commit()
    }
    await assignReceiptLetters()
  } catch (e) {
    // Offline on first run, or rules not published yet — try again next login
    console.warn('Admin setup skipped:', e?.code || e)
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined) // undefined = still checking
  const [profile, setProfile] = useState(null)
  const [profileLoaded, setProfileLoaded] = useState(false)
  const [role, setRole] = useState(null)

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setUser(u)
      setProfile(null)
      setRole(null)
      setProfileLoaded(false)
      if (u && isAdminEmail(u.email)) bootstrapAdmin(u)
    })
  }, [])

  // live profile (so turning a user off logs them out of features instantly)
  useEffect(() => {
    if (!user) return
    return onSnapshot(
      doc(db, 'users', user.uid),
      (snap) => {
        setProfile(snap.exists() ? { id: snap.id, ...snap.data() } : null)
        setProfileLoaded(true)
      },
      () => setProfileLoaded(true),
    )
  }, [user])

  // live role (so permission changes apply without re-login)
  const roleId = profile?.roleId
  useEffect(() => {
    if (!roleId || roleId === 'admin') {
      setRole(null)
      return
    }
    return onSnapshot(
      doc(db, 'roles', roleId),
      (snap) => setRole(snap.exists() ? { id: snap.id, ...snap.data() } : null),
      () => setRole(null),
    )
  }, [roleId])

  const isAdmin = !!user && isAdminEmail(user.email)

  const can = useCallback(
    (perm) => {
      if (!perm) return true
      if (isAdmin) return true
      if (ADMIN_ONLY.includes(perm)) return false
      return !!profile?.active && role?.permissions?.[perm] === true
    },
    [isAdmin, profile, role],
  )

  const login = useCallback(
    (usernameOrEmail, password) => signInWithEmailAndPassword(auth, usernameToEmail(usernameOrEmail), password),
    [],
  )
  const logout = useCallback(() => signOut(auth), [])

  const value = useMemo(
    () => ({
      user,
      profile,
      role,
      isAdmin,
      can,
      login,
      logout,
      loading: user === undefined || (!!user && !isAdmin && !profileLoaded),
      blocked: !!user && !isAdmin && profileLoaded && (!profile || profile.active !== true),
      displayName: profile?.name || (isAdmin ? 'Admin' : ''),
    }),
    [user, profile, role, isAdmin, can, login, logout, profileLoaded],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)
