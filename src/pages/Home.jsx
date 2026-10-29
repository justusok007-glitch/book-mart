import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useLang } from '../context/LangContext'
import { FEATURES } from '../lib/permissions'
import { OfflineBanner } from '../components/ui'
import Icon from '../components/Icon'

function Tile({ f, big }) {
  const { pick, t } = useLang()
  const to = f.ready ? f.path : `/soon/${f.key}`
  if (big) {
    return (
      <Link
        to={to}
        className="col-span-2 flex items-center gap-4 rounded-3xl bg-amber p-5 text-ink shadow-sm transition active:scale-[0.99]"
      >
        <div className="rounded-2xl bg-white/50 p-3">
          <Icon name={f.icon} size={34} />
        </div>
        <div className="flex-1">
          <div className="text-2xl font-bold">{pick(f)}</div>
          {!f.ready && <div className="text-sm opacity-70">{t('comingSoon')}</div>}
        </div>
        <Icon name="back" className="rotate-180 rtl:rotate-0" />
      </Link>
    )
  }
  return (
    <Link
      to={to}
      className="relative flex min-h-[110px] flex-col justify-between rounded-2xl border border-line bg-white p-4 transition hover:border-brand-500 active:scale-[0.98]"
    >
      <div className={`w-fit rounded-xl p-2.5 ${f.ready ? 'bg-brand-50 text-brand-600' : 'bg-paper text-muted'}`}>
        <Icon name={f.icon} size={24} />
      </div>
      <div className="mt-3 font-semibold leading-snug">{pick(f)}</div>
      {!f.ready && (
        <span className="absolute end-3 top-3 rounded-full bg-paper px-2 py-0.5 text-[11px] text-muted">
          {t('phase')} <span className="latin">{f.phase}</span>
        </span>
      )}
    </Link>
  )
}

export default function Home() {
  const { can, displayName, role, isAdmin, logout } = useAuth()
  const { t, pick } = useLang()
  const visible = FEATURES.filter((f) => can(f.perm))
  const sell = visible.find((f) => f.big)
  const rest = visible.filter((f) => !f.big)
  const roleName = isAdmin ? t('admin') : pick({ en: role?.name, ur: role?.nameUr })

  return (
    <div className="min-h-screen">
      <header className="bg-brand-600 text-white">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 pb-6 pt-5">
          <div className="rounded-2xl bg-white/10 p-2.5 text-amber">
            <Icon name="book" size={26} />
          </div>
          <div className="flex-1">
            <div className="text-sm text-white/70">{t('hello')}</div>
            <div className="text-lg font-bold leading-tight">
              {displayName}
              {roleName && <span className="ms-2 rounded-full bg-white/15 px-2 py-0.5 text-xs font-semibold">{roleName}</span>}
            </div>
          </div>
          <button onClick={logout} className="rounded-full p-2 hover:bg-white/10" aria-label={t('signOut')}>
            <Icon name="logout" className="rtl:rotate-180" />
          </button>
        </div>
      </header>
      <OfflineBanner />
      <main className="mx-auto max-w-3xl px-4 py-5">
        <p className="mb-3 text-sm font-semibold text-muted">{t('whatToDo')}</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {sell && <Tile f={sell} big />}
          {rest.map((f) => (
            <Tile key={f.key} f={f} />
          ))}
        </div>
      </main>
    </div>
  )
}
