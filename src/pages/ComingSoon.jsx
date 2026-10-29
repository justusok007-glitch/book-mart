import { useParams } from 'react-router-dom'
import { useLang } from '../context/LangContext'
import { FEATURES } from '../lib/permissions'
import { Badge, EmptyState, Page } from '../components/ui'

export default function ComingSoon() {
  const { key } = useParams()
  const { t, pick } = useLang()
  const f = FEATURES.find((x) => x.key === key)
  return (
    <Page title={f ? pick(f) : t('appName')}>
      <EmptyState
        icon={f?.icon || 'package'}
        title={t('comingSoon')}
        body={t('comingSoonBody')}
        action={
          f?.phase && (
            <Badge tone="lime">
              {t('phase')} <span className="latin ms-1">{f.phase}</span>
            </Badge>
          )
        }
      />
    </Page>
  )
}
