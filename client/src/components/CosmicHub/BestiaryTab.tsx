// Phase 11: stub. Реальная логика в Phase 18.
import { useTranslation } from 'react-i18next'

export function BestiaryTab() {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col items-center justify-center h-full gap-3 text-white/60">
      <div className="text-4xl">📖</div>
      <p className="text-sm">{t('cosmic_hub.bestiary_placeholder')}</p>
    </div>
  )
}
