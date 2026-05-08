// Phase 11: stub. Реальная логика в Phase 14.
import { useTranslation } from 'react-i18next'

export function SerumsTab() {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col items-center justify-center h-full gap-3 text-white/60">
      <div className="text-4xl">🧪</div>
      <p className="text-sm">{t('cosmic_hub.serums_placeholder')}</p>
    </div>
  )
}
