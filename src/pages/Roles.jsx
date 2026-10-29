import { useEffect, useState } from 'react'
import { collection, deleteDoc, doc, getDocs, query, serverTimestamp, setDoc, updateDoc, where } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { PERMISSION_GROUPS } from '../lib/permissions'
import { useLang } from '../context/LangContext'
import { Button, Card, Field, Notice, Page, Sheet } from '../components/ui'
import Icon from '../components/Icon'
import { useRoles } from './Users'

function RoleNameForm({ initial, onDone }) {
  const { t } = useLang()
  const [name, setName] = useState(initial?.name || '')
  const [nameUr, setNameUr] = useState(initial?.nameUr || '')
  const [error, setError] = useState('')

  async function save(e) {
    e.preventDefault()
    if (!name.trim()) return setError(t('fillRequired'))
    const data = { name: name.trim(), nameUr: nameUr.trim() }
    try {
      if (initial) {
        updateDoc(doc(db, 'roles', initial.id), data) // works offline, syncs later
        onDone(initial.id)
      } else {
        // pre-made id + no await: saves locally at once and syncs when online
        const ref = doc(collection(db, 'roles'))
        setDoc(ref, { ...data, permissions: {}, order: 50, system: false, createdAt: serverTimestamp() })
        onDone(ref.id)
      }
    } catch {
      setError(t('somethingWrong'))
    }
  }

  return (
    <form onSubmit={save} className="space-y-4">
      <Field label={t('roleNameEn')}>
        <input className="field latin" dir="ltr" value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      <Field label={t('roleNameUr')}>
        <input className="field font-urdu" dir="rtl" value={nameUr} onChange={(e) => setNameUr(e.target.value)} />
      </Field>
      <Notice>{error}</Notice>
      <Button type="submit" className="w-full py-3">
        {t('save')}
      </Button>
    </form>
  )
}

export default function Roles() {
  const { t, pick, lang } = useLang()
  const roles = useRoles()
  const [selected, setSelected] = useState('admin')
  const [sheet, setSheet] = useState(null) // null | 'new' | role
  const [error, setError] = useState('')

  useEffect(() => {
    if (selected !== 'admin' && roles.length && !roles.find((r) => r.id === selected)) setSelected('admin')
  }, [roles, selected])

  const role = roles.find((r) => r.id === selected)
  const isAdminRole = selected === 'admin'
  const has = (key) => isAdminRole || role?.permissions?.[key] === true

  function setPerm(key, value) {
    if (!role) return
    updateDoc(doc(db, 'roles', role.id), { [`permissions.${key}`]: value })
  }

  function setGroup(group, value) {
    if (!role) return
    const update = Object.fromEntries(group.perms.map((p) => [`permissions.${p.key}`, value]))
    updateDoc(doc(db, 'roles', role.id), update)
  }

  async function removeRole() {
    setError('')
    if (!navigator.onLine) return setError(t('needsInternet'))
    const used = await getDocs(query(collection(db, 'users'), where('roleId', '==', role.id)))
    if (!used.empty) return setError(t('roleInUse'))
    if (!window.confirm(t('confirmDeleteRole'))) return
    await deleteDoc(doc(db, 'roles', role.id))
    setSelected('admin')
  }

  const count = (r) => Object.values(r.permissions || {}).filter(Boolean).length

  return (
    <Page title={t('roles')}>
      <p className="mb-4 text-sm text-muted">{t('rolesIntro')}</p>

      {/* role chips */}
      <div className="-mx-4 mb-5 flex gap-2 overflow-x-auto px-4 pb-1">
        <button
          onClick={() => setSelected('admin')}
          className={`flex shrink-0 items-center gap-1.5 rounded-full border px-4 py-2 font-semibold ${
            isAdminRole ? 'border-brand-600 bg-brand-600 text-white' : 'border-line bg-white'
          }`}
        >
          <Icon name="lock" size={15} /> {t('admin')}
        </button>
        {roles.map((r) => (
          <button
            key={r.id}
            onClick={() => {
              setSelected(r.id)
              setError('')
            }}
            className={`shrink-0 rounded-full border px-4 py-2 font-semibold ${
              selected === r.id ? 'border-brand-600 bg-brand-600 text-white' : 'border-line bg-white'
            }`}
          >
            {pick({ en: r.name, ur: r.nameUr })}
            <span className="latin ms-1.5 text-xs opacity-70">{count(r)}</span>
          </button>
        ))}
        <button
          onClick={() => setSheet('new')}
          className="flex shrink-0 items-center gap-1 rounded-full border border-dashed border-brand-500 px-4 py-2 font-semibold text-brand-600"
        >
          <Icon name="plus" size={16} /> {t('addRole')}
        </button>
      </div>

      {isAdminRole && <Notice type="info">{t('adminAllPerms')}</Notice>}

      {role && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <h2 className="flex-1 text-xl font-bold">{pick({ en: role.name, ur: role.nameUr })}</h2>
          <Button variant="secondary" className="px-3 py-1.5 text-sm" onClick={() => setSheet(role)}>
            <Icon name="pencil" size={15} /> {t('edit')}
          </Button>
          {!role.system && (
            <Button variant="secondary" className="px-3 py-1.5 text-sm text-danger" onClick={removeRole}>
              <Icon name="trash" size={15} /> {t('deleteRole')}
            </Button>
          )}
        </div>
      )}
      {error && (
        <div className="mb-4">
          <Notice>{error}</Notice>
        </div>
      )}

      <div className="mt-4 space-y-4">
        {PERMISSION_GROUPS.map((g) => (
          <Card key={g.key} className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-line bg-paper/60 px-4 py-2.5">
              <h3 className="font-bold">{g.label[lang]}</h3>
              {!isAdminRole && (
                <div className="flex gap-1 text-sm">
                  <button className="rounded-lg px-2 py-0.5 font-semibold text-brand-600 hover:bg-brand-50" onClick={() => setGroup(g, true)}>
                    {t('selectAll')}
                  </button>
                  <button className="rounded-lg px-2 py-0.5 font-semibold text-muted hover:bg-line/50" onClick={() => setGroup(g, false)}>
                    {t('selectNone')}
                  </button>
                </div>
              )}
            </div>
            <ul>
              {g.perms.map((p) => {
                const checked = has(p.key)
                return (
                  <li key={p.key} className="border-b border-line/70 last:border-0">
                    <label className={`flex items-center gap-3 px-4 py-3 ${isAdminRole ? '' : 'cursor-pointer active:bg-paper'}`}>
                      <span
                        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 ${
                          checked ? 'border-brand-600 bg-brand-600 text-white' : 'border-line bg-white'
                        } ${isAdminRole ? 'opacity-60' : ''}`}
                      >
                        {checked && <Icon name="check" size={16} strokeWidth={3} />}
                      </span>
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={checked}
                        disabled={isAdminRole}
                        onChange={(e) => setPerm(p.key, e.target.checked)}
                      />
                      <span className="flex-1">{p[lang]}</span>
                    </label>
                  </li>
                )
              })}
            </ul>
          </Card>
        ))}
        <p className="text-center text-xs text-muted">{t('adminOnlyNote')}</p>
      </div>

      <Sheet open={!!sheet} title={sheet === 'new' ? t('addRole') : t('edit')} onClose={() => setSheet(null)}>
        {sheet && (
          <RoleNameForm
            key={sheet === 'new' ? 'new' : sheet.id}
            initial={sheet === 'new' ? null : sheet}
            onDone={(id) => {
              setSheet(null)
              setSelected(id)
            }}
          />
        )}
      </Sheet>
    </Page>
  )
}
