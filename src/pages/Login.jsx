import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useLang } from '../context/LangContext'
import { Button, Field, Notice, OfflineBanner } from '../components/ui'
import Icon from '../components/Icon'

export function LangSwitch({ dark = false }) {
  const { lang, setLang } = useLang()
  const base = dark ? 'border-white/30 text-white' : 'border-line text-ink bg-white'
  return (
    <div className={`inline-flex overflow-hidden rounded-full border ${base}`}>
      {[
        ['en', 'English'],
        ['ur', 'اردو'],
      ].map(([code, label]) => (
        <button
          key={code}
          onClick={() => setLang(code)}
          className={`px-3.5 py-1 text-sm font-semibold ${code === 'ur' ? 'font-urdu' : 'latin'} ${
            lang === code ? (dark ? 'bg-white text-brand-700' : 'bg-brand-600 text-white') : ''
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

export default function Login() {
  const { login } = useAuth()
  const { t } = useLang()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit(e) {
    e.preventDefault()
    if (!username.trim() || !password) return
    setBusy(true)
    setError('')
    try {
      await login(username, password)
    } catch (err) {
      const code = err?.code || ''
      if (code === 'auth/too-many-requests') setError(t('tooManyTries'))
      else if (code === 'auth/network-request-failed') setError(t('needInternetFirstLogin'))
      else setError(t('wrongLogin'))
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <OfflineBanner />
      <div className="relative bg-brand-600 px-6 pb-16 pt-10 text-white">
        <div className="mx-auto flex max-w-md items-start justify-between">
          <div>
            <div className="mb-4 inline-flex rounded-2xl bg-white/10 p-3 text-amber">
              <Icon name="book" size={34} />
            </div>
            <h1 className="text-3xl font-bold">{t('appName')}</h1>
            <p className="text-white/75">{t('tagline')}</p>
          </div>
          <LangSwitch dark />
        </div>
      </div>

      <form onSubmit={submit} className="mx-auto -mt-10 w-full max-w-md px-4">
        <div className="space-y-4 rounded-3xl border border-line bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold">{t('signInTitle')}</h2>
          <Field label={t('usernameOrEmail')}>
            <input
              className="field latin"
              dir="ltr"
              autoCapitalize="none"
              autoCorrect="off"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </Field>
          <Field label={t('password')}>
            <div className="relative">
              <input
                className="field latin pe-12"
                dir="ltr"
                type={show ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setShow((s) => !s)}
                className="absolute inset-y-0 end-0 px-3.5 text-muted"
                aria-label="show password"
              >
                <Icon name="eye" size={20} />
              </button>
            </div>
          </Field>
          <Notice>{error}</Notice>
          <Button type="submit" className="w-full py-3.5 text-base" disabled={busy}>
            {busy ? t('signingIn') : t('signIn')}
          </Button>
        </div>
      </form>
    </div>
  )
}
