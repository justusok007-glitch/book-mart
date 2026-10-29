import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useLang } from '../context/LangContext'
import { FEATURE_GROUPS, FEATURES } from '../lib/permissions'
import { Badge, IconButton, OfflineBanner, SectionTitle } from '../components/ui'
import Icon from '../components/Icon'

const featurePath = (f) => f.path || `/soon/${f.key}`

function SellBlock({ f }) {
  const { pick, t } = useLang()
  return (
    <Link
      to={featurePath(f)}
      className="group flex min-h-24 items-center gap-4 rounded-3xl bg-lime px-5 py-4 text-charcoal transition-colors duration-150 hover:bg-lime-600 active:bg-lime-600"
    >
      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white text-charcoal">
        <Icon name="cart" size={30} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-2xl font-bold leading-tight">{pick(f)}</div>
        <div className="text-sm font-medium text-charcoal/80">{t('scanOrSelect')}</div>
      </div>
      {f.preview && <Badge tone="dark">{t('preview')}</Badge>}
      <Icon name="chevron" size={26} className="shrink-0 rtl:rotate-180" />
    </Link>
  )
}

function Tile({ f }) {
  const { pick, t } = useLang()
  const ready = f.ready
  return (
    <Link
      to={featurePath(f)}
      className="flex min-h-[104px] flex-col justify-between gap-3 rounded-2xl border border-line bg-white p-4 transition-colors duration-150 hover:border-charcoal-500 active:bg-paper"
    >
      <div className="flex items-start justify-between gap-2">
        <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${ready ? 'bg-lime-100 text-charcoal' : 'bg-paper text-muted'}`}>
          <Icon name={f.icon} size={22} />
        </div>
        {!ready && (
          <Badge>
            {t('phase')} <span className="latin ms-1">{f.phase}</span>
          </Badge>
        )}
      </div>
      <div className={`font-semibold leading-snug ${ready ? 'text-ink' : 'text-muted'}`}>{pick(f)}</div>
    </Link>
  )
}

function TodayStrip() {
  const { t } = useLang()
  const stats = [
    { label: t('todaySales'), icon: 'cart' },
    { label: t('cashInHand'), icon: 'cash' },
    { label: t('lowStock'), icon: 'alert' },
  ]
  return (
    <div className="mb-6">
      <div className="grid grid-cols-3 gap-2.5">
        {stats.map((s) => (
          <div key={s.label} className="rounded-2xl border border-line bg-white p-3">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-muted">
              <Icon name={s.icon} size={14} />
              <span className="truncate">{s.label}</span>
            </div>
            <div className="latin mt-1 text-xl font-bold text-ink">—</div>
          </div>
        ))}
      </div>
      <p className="mt-2 text-xs text-muted">{t('statsLater')}</p>
    </div>
  )
}

export default function Home() {
  const { can, displayName, role, isAdmin, logout } = useAuth()
  const { t, pick } = useLang()
  const visible = FEATURES.filter((f) => can(f.perm))
  const sell = visible.find((f) => f.big)
  const roleName = isAdmin ? t('admin') : pick({ en: role?.name, ur: role?.nameUr })
  const showToday = can('daily_closing') || can('view_profit_loss')

  return (
    <div className="min-h-screen pb-8">
      <header className="safe-top border-b border-line bg-white">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <img src="./logo-mark.png" alt="Book Mart" className="h-11 w-11 object-contain" />
          <div className="min-w-0 flex-1">
            <div className="text-sm text-muted">{t('hello')}</div>
            <div className="flex items-center gap-2">
              <span className="truncate text-lg font-bold text-charcoal">{displayName}</span>
              {roleName && <Badge tone="lime">{roleName}</Badge>}
            </div>
          </div>
          <IconButton icon="logout" label={t('signOut')} onClick={logout} className="text-charcoal" iconClass="rtl:rotate-180" />
        </div>
      </header>
      <OfflineBanner />

      <main className="mx-auto max-w-3xl px-4 pt-5">
        {showToday && <TodayStrip />}

        {sell && (
          <div className="mb-7">
            <SellBlock f={sell} />
          </div>
        )}

        {FEATURE_GROUPS.map((g) => {
          const items = visible.filter((f) => f.group === g.key)
          if (!items.length) return null
          return (
            <section key={g.key} className="mb-7">
              <SectionTitle>{pick(g)}</SectionTitle>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {items.map((f) => (
                  <Tile key={f.key} f={f} />
                ))}
              </div>
            </section>
          )
        })}
      </main>
    </div>
  )
}
