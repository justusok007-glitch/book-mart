import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useLang } from '../context/LangContext'
import { Button, Field, Notice, OfflineBanner } from '../components/ui'
import Icon from '../components/Icon'

export function LangSwitch() {
  const { lang, setLang } = useLang()
  return (
    <div role="group" aria-label="Language" className="inline-flex rounded-full border border-line bg-white p-1">
      {[
        ['en', 'English'],
        ['ur', 'اردو'],
      ].map(([code, label]) => (
        <button
          key={code}
          onClick={() => setLang(code)}
          aria-pressed={lang === code}
          className={`min-h-10 min-w-20 cursor-pointer rounded-full px-4 text-sm font-semibold transition-colors duration-150 ${
            code === 'ur' ? 'font-urdu' : 'latin'
          } ${lang === code ? 'bg-charcoal text-white' : 'text-ink hover:bg-paper'}`}
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
    <div className="flex min-h-screen flex-col bg-white">
      <OfflineBanner />
      <div className="safe-top flex justify-end px-4 pt-4">
        <LangSwitch />
      </div>

      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col px-6 pb-10">
        <div className="mb-8 mt-4 flex flex-col items-center text-center">
          <img src="./logo.png" alt="Book Mart" className="h-auto w-44" />
          <p className="mt-3 text-muted">{t('tagline')}</p>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <h1 className="text-2xl font-bold text-charcoal">{t('signInTitle')}</h1>
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
                className="field latin pe-14"
                dir="ltr"
                type={show ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setShow((s) => !s)}
                className="absolute inset-y-0 end-0 flex w-12 cursor-pointer items-center justify-center text-muted hover:text-ink"
                aria-label={show ? 'Hide password' : 'Show password'}
                aria-pressed={show}
              >
                <Icon name="eye" size={20} />
              </button>
            </div>
          </Field>
          <Notice>{error}</Notice>
          <Button type="submit" size="lg" className="w-full" disabled={busy || !username.trim() || !password}>
            {busy ? t('signingIn') : t('signIn')}
          </Button>
        </form>

        <div className="mt-auto flex items-center justify-center gap-2 pt-10 text-xs text-muted">
          <span className="h-2 w-2 rounded-full bg-lime" aria-hidden="true" />
          {t('appName')} · {t('tagline')}
        </div>
      </div>
    </div>
  )
}
