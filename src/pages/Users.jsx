import { useEffect, useMemo, useState } from 'react'
import { createUserWithEmailAndPassword, signOut } from 'firebase/auth'
import { collection, doc, onSnapshot, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore'
import { db, getSecondaryAuth, usernameToEmail } from '../lib/firebase'
import { useAuth } from '../context/AuthContext'
import { useLang } from '../context/LangContext'
import { Button, Card, Field, Notice, Page, Sheet, Toggle } from '../components/ui'
import Icon from '../components/Icon'

export function useRoles() {
  const [roles, setRoles] = useState([])
  useEffect(
    () =>
      onSnapshot(collection(db, 'roles'), (snap) =>
        setRoles(
          snap.docs
            .map((d) => ({ id: d.id, ...d.data() }))
            .sort((a, b) => (a.order ?? 99) - (b.order ?? 99) || (a.name || '').localeCompare(b.name || '')),
        ),
      ),
    [],
  )
  return roles
}

const USERNAME_RE = /^[a-z0-9._-]{3,30}$/

function UserForm({ initial, roles, onDone }) {
  const { t, pick } = useLang()
  const { user: me } = useAuth()
  const isNew = !initial
  const [name, setName] = useState(initial?.name || '')
  const [username, setUsername] = useState(initial?.username || '')
  const [password, setPassword] = useState('')
  const [phone, setPhone] = useState(initial?.phone || '')
  const [roleId, setRoleId] = useState(initial?.roleId || roles[0]?.id || '')
  const [active, setActive] = useState(initial ? initial.active !== false : true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function save(e) {
    e.preventDefault()
    setError('')
    const uname = username.trim().toLowerCase()
    if (!name.trim() || !roleId || (isNew && (!uname || !password))) return setError(t('fillRequired'))
    if (isNew && !USERNAME_RE.test(uname)) return setError(t('usernameInvalid'))
    if (isNew && password.length < 6) return setError(t('passwordShort'))
    if (!navigator.onLine) return setError(t('needsInternet'))

    setBusy(true)
    try {
      if (isNew) {
        const sAuth = getSecondaryAuth()
        const email = usernameToEmail(uname)
        const cred = await createUserWithEmailAndPassword(sAuth, email, password)
        await setDoc(doc(db, 'users', cred.user.uid), {
          name: name.trim(),
          username: uname,
          email,
          phone: phone.trim(),
          roleId,
          active: true,
          createdAt: serverTimestamp(),
          createdBy: me.uid,
        })
        await signOut(sAuth)
      } else {
        await updateDoc(doc(db, 'users', initial.id), {
          name: name.trim(),
          phone: phone.trim(),
          roleId,
          active,
          updatedAt: serverTimestamp(),
          updatedBy: me.uid,
        })
      }
      onDone()
    } catch (err) {
      const code = err?.code || ''
      if (code === 'auth/email-already-in-use') setError(t('usernameTaken'))
      else if (code === 'auth/weak-password') setError(t('passwordShort'))
      else if (code === 'auth/network-request-failed') setError(t('needsInternet'))
      else setError(t('somethingWrong') + (code ? ` (${code})` : ''))
      setBusy(false)
    }
  }

  return (
    <form onSubmit={save} className="space-y-4">
      <Field label={t('name')}>
        <input className="field" value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      <Field label={t('username')} hint={isNew ? t('usernameHint') : undefined}>
        <input
          className="field latin disabled:bg-paper disabled:text-muted"
          dir="ltr"
          autoCapitalize="none"
          autoCorrect="off"
          value={username}
          disabled={!isNew}
          onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s/g, ''))}
        />
      </Field>
      {isNew && (
        <Field label={t('password')} hint={t('passwordHint')}>
          <input className="field latin" dir="ltr" type="text" value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
      )}
      <Field label={t('role')}>
        <select className="field" value={roleId} onChange={(e) => setRoleId(e.target.value)}>
          {roles.map((r) => (
            <option key={r.id} value={r.id}>
              {pick({ en: r.name, ur: r.nameUr })}
            </option>
          ))}
        </select>
      </Field>
      <Field label={`${t('phone')} (${t('optional')})`}>
        <input className="field latin" dir="ltr" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
      </Field>
      {!isNew && (
        <div className="flex items-center justify-between rounded-xl border border-line bg-white px-4 py-3">
          <span className="font-semibold">{active ? t('active') : t('inactive')}</span>
          <Toggle checked={active} onChange={setActive} />
        </div>
      )}
      {!isNew && <p className="text-xs text-muted">{t('forgotPasswordNote')}</p>}
      <Notice>{error}</Notice>
      <Button type="submit" className="w-full py-3" disabled={busy}>
        {busy ? t('saving') : t('save')}
      </Button>
    </form>
  )
}

export default function Users() {
  const { t, pick } = useLang()
  const { user: me } = useAuth()
  const roles = useRoles()
  const [users, setUsers] = useState(null)
  const [editing, setEditing] = useState(null) // null | 'new' | user object

  useEffect(
    () =>
      onSnapshot(collection(db, 'users'), (snap) =>
        setUsers(snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (a.name || '').localeCompare(b.name || ''))),
      ),
    [],
  )

  const roleName = useMemo(() => {
    const map = Object.fromEntries(roles.map((r) => [r.id, pick({ en: r.name, ur: r.nameUr })]))
    return (id) => (id === 'admin' ? t('admin') : map[id] || '—')
  }, [roles, pick, t])

  const staff = (users || []).filter((u) => u.roleId !== 'admin')
  const admins = (users || []).filter((u) => u.roleId === 'admin')

  return (
    <Page
      title={t('users')}
      right={
        <button
          onClick={() => setEditing('new')}
          className="flex items-center gap-1 rounded-full bg-white/15 px-3 py-1.5 text-sm font-semibold hover:bg-white/25"
        >
          <Icon name="plus" size={18} /> {t('addUser')}
        </button>
      }
    >
      <div className="space-y-2.5">
        {admins.map((u) => (
          <Card key={u.id} className="flex items-center gap-3 p-4">
            <div className="rounded-full bg-brand-50 p-2.5 text-brand-600">
              <Icon name="shield" size={20} />
            </div>
            <div className="flex-1">
              <div className="font-semibold">{u.name}</div>
              <div className="text-xs text-muted">{t('lockedAdmin')}</div>
            </div>
            <Icon name="lock" size={18} className="text-muted" />
          </Card>
        ))}

        {users && staff.length === 0 && <p className="py-8 text-center text-muted">{t('noUsers')}</p>}

        {staff.map((u) => {
          const self = u.id === me.uid
          return (
            <Card key={u.id} className={`flex items-center gap-3 p-4 ${u.active === false ? 'opacity-60' : ''}`}>
              <div className="rounded-full bg-paper p-2.5 text-muted">
                <Icon name="user" size={20} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold">
                  {u.name} {self && <span className="text-xs text-muted">({t('you')})</span>}
                </div>
                <div className="flex flex-wrap items-center gap-x-2 text-xs text-muted">
                  <span className="latin" dir="ltr">@{u.username}</span>
                  <span className="rounded-full bg-brand-50 px-2 py-0.5 font-semibold text-brand-700">{roleName(u.roleId)}</span>
                  {u.active === false && <span className="rounded-full bg-danger-50 px-2 py-0.5 font-semibold text-danger">{t('inactive')}</span>}
                </div>
              </div>
              {!self && (
                <button onClick={() => setEditing(u)} className="rounded-full p-2 text-brand-600 hover:bg-brand-50" aria-label={t('edit')}>
                  <Icon name="pencil" size={18} />
                </button>
              )}
            </Card>
          )
        })}
      </div>

      <Sheet open={!!editing} title={editing === 'new' ? t('addUser') : t('editUser')} onClose={() => setEditing(null)}>
        {editing && (
          <UserForm
            key={editing === 'new' ? 'new' : editing.id}
            initial={editing === 'new' ? null : editing}
            roles={roles}
            onDone={() => setEditing(null)}
          />
        )}
      </Sheet>
    </Page>
  )
}
