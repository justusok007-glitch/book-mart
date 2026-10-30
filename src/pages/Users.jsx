import { useEffect, useMemo, useState } from 'react'
import { createUserWithEmailAndPassword, signOut } from 'firebase/auth'
import { collection, deleteDoc, doc, onSnapshot, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore'
import { db, getSecondaryAuth, usernameToEmail } from '../lib/firebase'
import { useAuth } from '../context/AuthContext'
import { useLang } from '../context/LangContext'
import { Badge, Button, Card, EmptyState, Field, Notice, Page, Sheet, Toggle } from '../components/ui'
import Icon from '../components/Icon'
import { errorText } from '../lib/errors'
import { formatReceipt, LETTER_RE, nextLetter } from '../lib/saleMath'

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

function UserForm({ initial, roles, users = [], onDone }) {
  const { t, pick } = useLang()
  const { user: me, isAdmin } = useAuth()
  const isNew = !initial
  const [name, setName] = useState(initial?.name || '')
  const [username, setUsername] = useState(initial?.username || '')
  const [password, setPassword] = useState('')
  const [phone, setPhone] = useState(initial?.phone || '')
  const [roleId, setRoleId] = useState(initial?.roleId || roles[0]?.id || '')
  const [active, setActive] = useState(initial ? initial.active !== false : true)
  const others = users.filter((u) => u.id !== initial?.id).map((u) => u.receiptLetter).filter(Boolean)
  const [letter, setLetter] = useState(initial?.receiptLetter || nextLetter(others) || '')
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
    if (!LETTER_RE.test(letter)) return setError(t('letterInvalid'))
    if (others.includes(letter)) return setError(t('letterTaken'))

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
          receiptLetter: letter,
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
          receiptLetter: letter,
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
      <Field label={t('receiptLetter')} hint={`${t('receiptLetterHint')} ${letter ? formatReceipt(letter, 1) + ', ' + formatReceipt(letter, 2) + '…' : ''}`}>
        <input
          className="field latin w-28 text-center text-lg font-bold uppercase"
          dir="ltr"
          maxLength={2}
          autoCapitalize="characters"
          value={letter}
          onChange={(e) => setLetter(e.target.value.toUpperCase().replace(/[^A-Z]/g, ''))}
        />
      </Field>
      {!isNew && (
        <div className="flex items-center justify-between rounded-xl border border-line bg-white ps-4 pe-1">
          <span className={`font-semibold ${active ? 'text-leaf' : 'text-danger'}`}>{active ? t('active') : t('inactive')}</span>
          <Toggle checked={active} onChange={setActive} label={t('active')} />
        </div>
      )}
      {!isNew && <p className="text-xs text-muted">{t('forgotPasswordNote')}</p>}
      <Notice>{error}</Notice>
      <Button type="submit" size="lg" className="w-full" disabled={busy}>
        {busy ? t('saving') : t('save')}
      </Button>
      {!isNew && isAdmin && initial.id !== me.uid && (
        <Button
          type="button"
          variant="danger"
          size="lg"
          className="w-full"
          disabled={busy}
          onClick={async () => {
            if (!window.confirm(`${t('confirmDeleteUser')}\n\n${initial.name} (@${initial.username})`)) return
            if (!navigator.onLine) return setError(t('needsInternet'))
            setBusy(true)
            try {
              await deleteDoc(doc(db, 'users', initial.id))
              onDone(t('userDeleted'))
            } catch (err) {
              setError(errorText(err, t))
              setBusy(false)
            }
          }}
        >
          <Icon name="trash" size={20} /> {t('deleteUser')}
        </Button>
      )}
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
        <Button size="sm" onClick={() => setEditing('new')} className="me-1">
          <Icon name="plus" size={18} /> {t('addUser')}
        </Button>
      }
    >
      <div className="space-y-2.5">
        {admins.map((u) => (
          <Card key={u.id} className="flex min-h-[72px] items-center gap-3 px-4 py-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-charcoal text-white">
              <Icon name="shield" size={20} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate font-semibold">{u.name}</div>
              <div className="flex flex-wrap items-center gap-1.5 text-sm text-muted">
                {t('lockedAdmin')}
                {u.receiptLetter && <Badge><span className="latin">{formatReceipt(u.receiptLetter, 1)}…</span></Badge>}
              </div>
            </div>
            <Icon name="lock" size={18} className="text-muted" />
          </Card>
        ))}

        {users && staff.length === 0 && (
          <EmptyState
            icon="users"
            body={t('noUsers')}
            action={
              <Button onClick={() => setEditing('new')}>
                <Icon name="plus" size={18} /> {t('addUser')}
              </Button>
            }
          />
        )}

        {staff.map((u) => {
          const self = u.id === me.uid
          const off = u.active === false
          const Row = self ? 'div' : 'button'
          return (
            <Row
              key={u.id}
              {...(self ? {} : { type: 'button', onClick: () => setEditing(u) })}
              className={`flex min-h-[72px] w-full items-center gap-3 rounded-2xl border border-line bg-white px-4 py-3 text-start transition-colors duration-150 ${
                self ? '' : 'cursor-pointer hover:border-charcoal-500 active:bg-paper'
              }`}
            >
              <div
                className={`latin flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-lg font-bold ${
                  off ? 'bg-paper text-muted' : 'bg-lime-100 text-charcoal'
                }`}
                aria-hidden="true"
              >
                {(u.username || u.name || '?').charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className={`truncate font-semibold ${off ? 'text-muted' : ''}`}>
                  {u.name} {self && <span className="text-sm font-normal text-muted">({t('you')})</span>}
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                  <span className="latin text-sm text-muted" dir="ltr">@{u.username}</span>
                  <Badge tone="lime">{roleName(u.roleId)}</Badge>
                  {u.receiptLetter && <Badge><span className="latin">{formatReceipt(u.receiptLetter, 1)}…</span></Badge>}
                  {off && <Badge tone="danger">{t('inactive')}</Badge>}
                </div>
              </div>
              {!self && <Icon name="chevron" size={20} className="shrink-0 text-muted rtl:rotate-180" />}
            </Row>
          )
        })}
      </div>

      <Sheet open={!!editing} title={editing === 'new' ? t('addUser') : t('editUser')} onClose={() => setEditing(null)}>
        {editing && (
          <UserForm
            key={editing === 'new' ? 'new' : editing.id}
            initial={editing === 'new' ? null : editing}
            roles={roles}
            users={users || []}
            onDone={() => setEditing(null)}
          />
        )}
      </Sheet>
    </Page>
  )
}
