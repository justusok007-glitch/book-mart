import { useEffect, useState } from 'react'
import { collection, deleteDoc, doc, getDocs, query, serverTimestamp, setDoc, updateDoc, where } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { PERMISSION_GROUPS } from '../lib/permissions'
import { useLang } from '../context/LangContext'
import { Button, Card, Checkbox, Field, Notice, Page, Sheet, Toggle } from '../components/ui'
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
      <Button type="submit" size="lg" className="w-full">
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

  const chip = (active) =>
    `flex min-h-12 shrink-0 cursor-pointer items-center gap-2 rounded-full border-[1.5px] px-4 font-semibold transition-colors duration-150 ${
      active ? 'border-charcoal bg-charcoal text-white' : 'border-line bg-white text-ink hover:border-charcoal-500'
    }`

  return (
    <Page title={t('roles')}>
      <p className="mb-4 text-muted">{t('rolesIntro')}</p>

      {/* role selector */}
      <div className="no-scrollbar -mx-4 mb-6 flex gap-2 overflow-x-auto px-4 pb-1" role="tablist">
        <button role="tab" aria-selected={isAdminRole} onClick={() => setSelected('admin')} className={chip(isAdminRole)}>
          <Icon name="lock" size={16} /> {t('admin')}
        </button>
        {roles.map((r) => (
          <button
            key={r.id}
            role="tab"
            aria-selected={selected === r.id}
            onClick={() => {
              setSelected(r.id)
              setError('')
            }}
            className={chip(selected === r.id)}
          >
            {pick({ en: r.name, ur: r.nameUr })}
            {r.training && <Icon name="book" size={14} />}
            <span
              className={`latin rounded-full px-2 text-xs ${selected === r.id ? 'bg-lime text-charcoal' : 'bg-paper text-muted'}`}
            >
              {count(r)}
            </span>
          </button>
        ))}
        <button
          onClick={() => setSheet('new')}
          className="flex min-h-12 shrink-0 cursor-pointer items-center gap-1.5 rounded-full border-[1.5px] border-dashed border-charcoal-500 px-4 font-semibold text-charcoal hover:bg-white"
        >
          <Icon name="plus" size={18} /> {t('addRole')}
        </button>
      </div>

      {isAdminRole && (
        <Card className="mb-4 flex items-center gap-3 p-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-charcoal text-white">
            <Icon name="shield" size={20} />
          </div>
          <p className="font-medium">{t('adminAllPerms')}</p>
        </Card>
      )}

      {role && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <h2 className="min-w-0 flex-1 truncate text-xl font-bold text-charcoal">{pick({ en: role.name, ur: role.nameUr })}</h2>
          <Button variant="secondary" size="sm" onClick={() => setSheet(role)}>
            <Icon name="pencil" size={16} /> {t('edit')}
          </Button>
          {!role.system && (
            <Button variant="danger" size="sm" onClick={removeRole}>
              <Icon name="trash" size={16} /> {t('deleteRole')}
            </Button>
          )}
        </div>
      )}
      {role && role.id !== 'owner' && (
        <Card className={`mb-4 p-4 ${role.training ? 'border-warn bg-warn-50' : ''}`}>
          <div className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2 font-semibold">
              <Icon name="book" size={18} /> {t('trainingRole')}
            </span>
            <Toggle checked={role.training === true} label={t('trainingRole')} onChange={(on) => updateDoc(doc(db, 'roles', role.id), { training: on })} />
          </div>
          <p className="mt-1 text-sm text-muted">{t('trainingRoleHint')}</p>
        </Card>
      )}
      {error && (
        <div className="mb-4">
          <Notice>{error}</Notice>
        </div>
      )}

      <div className="space-y-4">
        {PERMISSION_GROUPS.map((g) => {
          const onCount = g.perms.filter((p) => has(p.key)).length
          return (
            <Card key={g.key} className="overflow-hidden">
              <div className="flex min-h-14 items-center justify-between gap-2 border-b border-line bg-paper/70 ps-4 pe-2">
                <h3 className="font-bold">
                  {g.label[lang]}
                  <span className="latin ms-2 text-sm font-semibold text-muted">
                    {onCount}/{g.perms.length}
                  </span>
                </h3>
                {!isAdminRole && (
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" onClick={() => setGroup(g, true)}>
                      {t('selectAll')}
                    </Button>
                    <Button variant="ghost" size="sm" className="text-muted" onClick={() => setGroup(g, false)}>
                      {t('selectNone')}
                    </Button>
                  </div>
                )}
              </div>
              <ul>
                {g.perms.map((p) => {
                  const checked = has(p.key)
                  return (
                    <li key={p.key} className="border-b border-line/70 last:border-0">
                      <label
                        className={`flex min-h-14 items-center gap-3 px-4 py-2 transition-colors duration-150 ${
                          isAdminRole ? '' : 'cursor-pointer hover:bg-paper/60 active:bg-paper'
                        }`}
                      >
                        <input
                          type="checkbox"
                          className="peer sr-only"
                          checked={checked}
                          disabled={isAdminRole}
                          onChange={(e) => setPerm(p.key, e.target.checked)}
                        />
                        <Checkbox checked={checked} disabled={isAdminRole} />
                        <span className={`flex-1 ${checked ? 'text-ink' : 'text-muted'}`}>{p[lang]}</span>
                      </label>
                    </li>
                  )
                })}
              </ul>
            </Card>
          )
        })}
        <p className="flex items-center justify-center gap-1.5 text-center text-sm text-muted">
          <Icon name="lock" size={14} /> {t('adminOnlyNote')}
        </p>
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
