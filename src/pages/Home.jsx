import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useLang } from '../context/LangContext'
import { FEATURE_GROUPS, FEATURES } from '../lib/permissions'
import { useCatalog } from '../lib/catalog'
import { useDayStats } from '../lib/selling'
import { dayKey } from '../lib/saleMath'
import { Badge, IconButton, OfflineBanner } from '../components/ui'
import Icon from '../components/Icon'

const featurePath = (f) => f.path || `/soon/${f.key}`

// The big lime Sell button — it sits half over the charcoal counter above it
function SellBlock({ f }) {
  const { pick, t } = useLang()
  return (
    <Link
      to={featurePath(f)}
      className="group flex min-h-24 items-center gap-4 rounded-3xl bg-lime px-5 py-4 text-charcoal shadow-[0_10px_24px_-12px_rgb(55_52_53/0.55)] transition-colors duration-150 hover:bg-lime-600 active:bg-lime-600"
    >
      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-charcoal text-lime">
        <Icon name="cart" size={28} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-2xl font-bold leading-tight">{pick(f)}</div>
        <div className="text-sm font-medium text-charcoal/80">{t('scanOrSelect')}</div>
      </div>
      {f.preview && <Badge tone="dark">{t('preview')}</Badge>}
      <Icon name="chevron" size={26} className="shrink-0 transition-transform duration-150 group-hover:translate-x-0.5 rtl:rotate-180" />
    </Link>
  )
}

// one rectangular tile: icon on top, name below
function Tile({ f }) {
  const { pick, t } = useLang()
  return (
    <Link
      to={featurePath(f)}
      className="flex min-h-[104px] flex-col justify-between gap-3 rounded-2xl border border-line bg-white p-4 transition-colors duration-150 hover:border-charcoal-500 active:bg-lime-50"
    >
      <div className="flex items-start justify-between gap-2">
        <span className={`flex h-11 w-11 items-center justify-center rounded-xl ${f.ready ? 'bg-lime-100 text-charcoal' : 'bg-paper text-muted'}`}>
          <Icon name={f.icon} size={22} />
        </span>
        {!f.ready && (
          <Badge>
            {t('phase')} <span className="latin ms-1">{f.phase}</span>
          </Badge>
        )}
      </div>
      <span className={`font-medium leading-snug ${f.ready ? 'text-ink' : 'text-muted'}`}>{pick(f)}</span>
    </Link>
  )
}

// Today's figures, shown like the display on a shop till
function Counter() {
  const { t } = useLang()
  const { ready, lowList } = useCatalog()
  const { can } = useAuth()
  const today = useDayStats(dayKey(), can('daily_closing') || can('view_profit_loss') || can('view_sales'))
  const money = (n) => (today ? Number(n || 0).toLocaleString('en-PK', { maximumFractionDigits: 0 }) : '—')
  const stats = [
    {
      label: t('todaySales'),
      // net of returns: what was sold minus what came back today
      value: money((today?.salesTotal || 0) - (today?.returnsTotal || 0)),
      rs: true,
      sub: today?.returnsTotal > 0 ? `${t('returnsShort')} ${Number(today.returnsTotal).toLocaleString('en-PK')}` : null,
      to: can('view_sales') ? '/sales' : null,
    },
    { label: t('cashReceivedToday'), value: money(today?.cashIn), rs: true, to: can('daily_closing') ? '/closing' : null },
    { label: t('lowStock'), value: ready ? lowList.length : '—', to: '/low-stock', alert: ready && lowList.length > 0 },
  ]
  return (
    <div className="grid grid-cols-3 [&>*+*]:border-s [&>*+*]:border-white/15">
      {stats.map((s) => {
        const body = (
          <>
            <div className="text-xs font-medium leading-tight text-white/70">{s.label}</div>
            <div className="latin mt-1.5 flex items-baseline gap-1 whitespace-nowrap" dir="ltr">
              {s.rs && <span className="text-xs font-medium text-white/60">Rs</span>}
              <span className={`text-[22px] font-semibold leading-none ${s.alert ? 'text-warn' : 'text-white'}`}>{s.value}</span>
              {s.alert && <Icon name="alert" size={14} className="text-warn" />}
            </div>
            {s.sub && <div className="latin mt-1 text-[11px] text-white/60">{s.sub}</div>}
          </>
        )
        return s.to ? (
          <Link key={s.label} to={s.to} className="block px-3 py-1 first:ps-0 last:pe-0 hover:opacity-90">
            {body}
          </Link>
        ) : (
          <div key={s.label} className="px-3 py-1 first:ps-0 last:pe-0">
            {body}
          </div>
        )
      })}
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
    <div className="min-h-screen pb-10">
      <header className="app-bar safe-top bg-charcoal">
        <div className={`mx-auto max-w-3xl px-4 ${sell ? 'pb-14' : 'pb-6'}`}>
          <div className="flex items-center gap-3 py-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white">
              <img src="./logo-mark.png" alt="Book Mart" className="h-9 w-9 object-contain" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-sm text-white/70">{t('hello')}</div>
              <div className="flex items-center gap-2">
                <span className="truncate text-lg font-semibold text-white">{displayName}</span>
                {roleName && <Badge tone="lime">{roleName}</Badge>}
              </div>
            </div>
            <IconButton icon="logout" label={t('signOut')} onClick={logout} iconClass="rtl:rotate-180" />
          </div>
          {showToday && (
            <div className="mt-2 border-t border-white/15 pt-4">
              <Counter />
            </div>
          )}
        </div>
      </header>
      <OfflineBanner />

      <main className="mx-auto max-w-3xl px-4">
        {sell && (
          <div className="relative z-10 -mt-10 mb-7">
            <SellBlock f={sell} />
          </div>
        )}
        {!sell && <div className="h-5" />}

        {FEATURE_GROUPS.map((g) => {
          const items = visible.filter((f) => f.group === g.key)
          if (!items.length) return null
          return (
            <section key={g.key} className="mb-7">
              <h2 className="mb-2.5 px-1 text-[15px] font-semibold text-charcoal">{pick(g)}</h2>
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
