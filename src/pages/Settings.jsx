import { useEffect, useState } from 'react'
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword } from 'firebase/auth'
import { doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore'
import { db, emailToUsername } from '../lib/firebase'
import { useAuth } from '../context/AuthContext'
import { useLang } from '../context/LangContext'
import { Button, Card, Field, Notice, Page } from '../components/ui'
import Icon from '../components/Icon'
import { LangSwitch } from './Login'

function Section({ icon, title, children }) {
  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center gap-2.5">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-lime-100 text-charcoal">
          <Icon name={icon} size={20} />
        </div>
        <h2 className="text-lg font-bold text-charcoal">{title}</h2>
      </div>
      {children}
    </Card>
  )
}

function ShopInfo() {
  const { t } = useLang()
  const [form, setForm] = useState({ name: 'Book Mart', phone: '', address: '', footer: '' })
  const [msg, setMsg] = useState('')

  useEffect(
    () =>
      onSnapshot(doc(db, 'settings', 'shop'), (snap) => {
        if (snap.exists()) setForm((f) => ({ ...f, ...snap.data() }))
      }),
    [],
  )

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  function save(e) {
    e.preventDefault()
    setDoc(doc(db, 'settings', 'shop'), { ...form, updatedAt: serverTimestamp() }, { merge: true })
    setMsg(t('saved'))
    setTimeout(() => setMsg(''), 2000)
  }

  return (
    <form onSubmit={save} className="space-y-3.5">
      <Field label={t('shopName')}>
        <input className="field" value={form.name} onChange={set('name')} />
      </Field>
      <Field label={t('phone')}>
        <input className="field latin" dir="ltr" inputMode="tel" value={form.phone} onChange={set('phone')} />
      </Field>
      <Field label={t('address')}>
        <input className="field" value={form.address} onChange={set('address')} />
      </Field>
      <Field label={t('receiptFooter')}>
        <input className="field" value={form.footer} onChange={set('footer')} />
      </Field>
      <Notice type="ok">{msg}</Notice>
      <Button type="submit">{t('save')}</Button>
    </form>
  )
}

function ChangePassword() {
  const { t } = useLang()
  const { user } = useAuth()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState({ type: 'error', text: '' })

  async function submit(e) {
    e.preventDefault()
    if (next.length < 6) return setMsg({ type: 'error', text: t('passwordShort') })
    if (!navigator.onLine) return setMsg({ type: 'error', text: t('needsInternet') })
    setBusy(true)
    try {
      await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, current))
      await updatePassword(user, next)
      setMsg({ type: 'ok', text: t('passwordChanged') })
      setCurrent('')
      setNext('')
    } catch (err) {
      const code = err?.code || ''
      setMsg({
        type: 'error',
        text: code === 'auth/invalid-credential' || code === 'auth/wrong-password' ? t('wrongCurrentPassword') : t('somethingWrong'),
      })
    }
    setBusy(false)
  }

  return (
    <form onSubmit={submit} className="space-y-3.5">
      <Field label={t('currentPassword')}>
        <input className="field latin" dir="ltr" type="password" value={current} onChange={(e) => setCurrent(e.target.value)} />
      </Field>
      <Field label={t('newPassword')} hint={t('passwordHint')}>
        <input className="field latin" dir="ltr" type="password" value={next} onChange={(e) => setNext(e.target.value)} />
      </Field>
      <Notice type={msg.type}>{msg.text}</Notice>
      <Button type="submit" disabled={busy || !current || !next}>
        {busy ? t('saving') : t('save')}
      </Button>
    </form>
  )
}

export default function Settings() {
  const { t } = useLang()
  const { can, user, displayName, logout } = useAuth()
  return (
    <Page title={t('settings')}>
      <div className="space-y-4">
        <Section icon="globe" title={t('language')}>
          <LangSwitch />
        </Section>

        {can('shop_settings') && (
          <Section icon="receipt" title={t('shopInfo')}>
            <ShopInfo />
          </Section>
        )}

        <Section icon="printer" title={t('receiptPrinter')}>
          <ol className="list-decimal space-y-1.5 ps-5 text-sm text-muted">
            <li>{t('printerStep1')}</li>
            <li>{t('printerStep2')}</li>
            <li>{t('printerStep3')}</li>
          </ol>
          <p className="mt-3 text-sm text-muted">{t('printerApkNote')}</p>
        </Section>

        <Section icon="lock" title={t('changePassword')}>
          <ChangePassword />
        </Section>

        <Card className="flex items-center gap-3 p-5">
          <div className="flex-1 text-sm">
            <div className="text-muted">{t('signedInAs')}</div>
            <div className="font-semibold">{displayName}</div>
            <div className="latin text-xs text-muted" dir="ltr">
              {emailToUsername(user?.email)}
            </div>
          </div>
          <Button variant="danger" onClick={logout}>
            <Icon name="logout" size={18} className="rtl:rotate-180" /> {t('signOut')}
          </Button>
        </Card>

        <div className="flex flex-col items-center gap-2 pt-4 text-sm text-muted">
          <img src="./logo-mark.png" alt="" className="h-10 w-10 object-contain opacity-80" />
          <span>
            {t('appName')} · {t('version')} <span className="latin">0.2.0</span>
          </span>
        </div>
      </div>
    </Page>
  )
}
