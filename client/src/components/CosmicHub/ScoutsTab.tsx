// Phase 11: stub. Реальная логика в Phase 16.
import { useTranslation } from 'react-i18next'

export function ScoutsTab() {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col items-center justify-center h-full gap-3 text-white/60">
      <div className="text-4xl">🚀</div>
      <p className="text-sm">{t('cosmic_hub.scouts_placeholder')}</p>
    </div>
  )
}
