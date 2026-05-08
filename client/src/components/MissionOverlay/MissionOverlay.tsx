// Phase 16: Mission overlay — fullscreen mini-clicker.
// REQ MISSION-01..08.

import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  pickRandomMissionType, scoreToResult, findPlanetById,
  type MissionType,
} from '../../game/data/missionConfig'
import { eventBus } from '../../store/eventBus'
import { RhythmTapMission } from './RhythmTapMission'
import { DefendMission } from './DefendMission'
import { HotSpotMission } from './HotSpotMission'

interface Props {
  planetId: string
  onClose: () => void  // unmount overlay (parent owns activeMissionPlanetId state)
  forceType?: MissionType  // dev override (Plan 16-05 dev panel)
}

export function MissionOverlay({ planetId, onClose, forceType }: Props) {
  const { t } = useTranslation()
  const planet = findPlanetById(planetId)
  const missionType: MissionType = useMemo(() => {
    if (forceType) return forceType
    if (import.meta.env.DEV) {
      const forced = localStorage.getItem('__force_mission_type')
      if (forced === 'rhythm' || forced === 'defend' || forced === 'hotspot') {
        return forced as MissionType
      }
    }
    return pickRandomMissionType()
  }, [forceType])

  const [phase, setPhase] = useState<'intro' | 'active' | 'done'>('intro')
  const [skipVisible, setSkipVisible] = useState(false)

  // 1s intro → active
  useEffect(() => {
    const id = window.setTimeout(() => setPhase('active'), 1000)
    return () => window.clearTimeout(id)
  }, [])

  // Skip button visible с 1s (REQ MISSION-04)
  useEffect(() => {
    const id = window.setTimeout(() => setSkipVisible(true), 1000)
    return () => window.clearTimeout(id)
  }, [])

  const finish = (score: number) => {
    if (phase === 'done') return
    setPhase('done')
    const result = scoreToResult(score)
    eventBus.emit('cosmic:mission-complete', { planetId, result })
    onClose()
  }

  const handleSkip = () => {
    eventBus.emit('cosmic:mission-cancel')
    finish(0)  // skip = score 0 → fail
  }

  const renderMission = () => {
    if (phase !== 'active') return null
    switch (missionType) {
      case 'rhythm': return <RhythmTapMission onComplete={finish} />
      case 'defend': return <DefendMission onComplete={finish} />
      case 'hotspot': return <HotSpotMission onComplete={finish} />
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex flex-col items-center justify-center bg-gradient-to-b from-gray-950 to-black">
      {/* Backdrop: ship + planet preview (REQ MISSION-08) */}
      <div className="absolute top-4 left-4 text-white/40 text-xs">
        🚀 → {planet?.name ?? planetId}
      </div>

      {/* Mission title */}
      <div className="absolute top-12 text-white text-lg font-bold">
        {t(`mission.title_${missionType}`)}
      </div>

      {/* Intro phase */}
      {phase === 'intro' && (
        <div className="text-white/80 text-sm animate-pulse">
          {t('mission.intro_warmup')}
        </div>
      )}

      {/* Active mission */}
      {renderMission()}

      {/* Skip button (REQ MISSION-04) */}
      {skipVisible && phase !== 'done' && (
        <button
          onClick={handleSkip}
          className="absolute bottom-4 right-4 px-4 py-2 bg-white/10 hover:bg-white/20 rounded text-sm text-white/80"
        >
          {t('mission.skip')}
        </button>
      )}
    </div>
  )
}
