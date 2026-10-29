import { useParams } from 'react-router-dom'
import { useLang } from '../context/LangContext'
import { FEATURES } from '../lib/permissions'
import { Page } from '../components/ui'
import Icon from '../components/Icon'

export default function ComingSoon() {
  const { key } = useParams()
  const { t, pick } = useLang()
  const f = FEATURES.find((x) => x.key === key)
  return (
    <Page title={f ? pick(f) : t('appName')}>
      <div className="mt-14 flex flex-col items-center gap-3 text-center">
        <div className="rounded-3xl bg-amber-50 p-5 text-amber">
          <Icon name={f?.icon || 'package'} size={44} />
        </div>
        <h2 className="text-xl font-bold">{t('comingSoon')}</h2>
        {f?.phase && (
          <span className="rounded-full bg-brand-50 px-3 py-1 text-sm font-semibold text-brand-700">
            {t('phase')} <span className="latin">{f.phase}</span>
          </span>
        )}
        <p className="max-w-xs text-muted">{t('comingSoonBody')}</p>
      </div>
    </Page>
  )
}
