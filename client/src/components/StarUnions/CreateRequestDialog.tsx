import { useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import type { ClanRequestDto, ClanRequestType } from '../../api/clan'
import { createRequest } from '../../api/clan'
import { getSlimeCap } from '../../utils/clanLimits'
import { useModalLock } from '../../utils/modalLock'
import { Icon } from '../../ui/icons/Icon'
import { ELEMENTS, type Element } from '../../store/cosmic/types'
import { ELEMENT_TINT, ELEMENT_BOTTLE_FILTER } from '../CosmicHub/ElementGrid'

interface Props {
  clanId: number
  onClose: () => void
  onCreated: (reqs: ClanRequestDto[]) => void
}

const SLIME_PRESETS = [0.25, 0.5, 0.75, 1.0] as const
const PRESET_LABELS = ['25%', '50%', '75%', '100%'] as const

export function CreateRequestDialog({ clanId, onClose, onCreated }: Props) {
  useModalLock()
  // 2026-05-28: SLIME-запрос вырезан из UI. Default — ESSENCE.
  const [type, setType] = useState<ClanRequestType>('ESSENCE')
  const [slimePreset, setSlimePreset] = useState<number | null>(null)
  // serumCounts: Element -> 0|1|2 (how many of that element selected)
  const [serumCounts, setSerumCounts] = useState<Record<Element, number>>(
    () => Object.fromEntries(ELEMENTS.map((e) => [e, 0])) as Record<Element, number>,
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [closing, setClosing] = useState(false)

  const handleClose = useCallback(() => {
    if (closing) return
    setClosing(true)
    window.setTimeout(onClose, 280)
  }, [closing, onClose])

  const slimeCap = getSlimeCap()
  const slimeAmount = slimePreset !== null ? Math.floor(slimeCap * slimePreset) : 0

  const serumTotal = ELEMENTS.reduce((sum, e) => sum + serumCounts[e], 0)

  function handleTypeChange(t: ClanRequestType) {
    setType(t)
    setError(null)
  }

  function handleSerumSlotClick(el: Element) {
    if (serumCounts[el] > 0) {
      // already has some — increment if room, else do nothing (ghost)
      if (serumTotal < 2) {
        setSerumCounts((prev) => ({ ...prev, [el]: prev[el] + 1 }))
      }
    } else {
      // new element
      if (serumTotal < 2) {
        setSerumCounts((prev) => ({ ...prev, [el]: 1 }))
      }
    }
    setError(null)
  }

  function handleSerumRemove(el: Element) {
    setSerumCounts((prev) => ({ ...prev, [el]: Math.max(0, prev[el] - 1) }))
    setError(null)
  }

  const selectedSerumElements: { el: Element; count: number }[] = ELEMENTS.filter(
    (e) => serumCounts[e] > 0,
  ).map((e) => ({ el: e, count: serumCounts[e] }))

  async function handleSubmit() {
    if (loading) return
    setError(null)

    if (type === 'SLIME') {
      if (slimeCap === 0) {
        setError('Нет дохода слизи — нужен трактор')
        return
      }
      if (slimePreset === null || slimeAmount < 1) {
        setError('Выберите количество')
        return
      }
      setLoading(true)
      try {
        const req = await createRequest(clanId, { type: 'SLIME', amount: String(slimeAmount) })
        onCreated([req])
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Ошибка при создании запроса')
      } finally {
        setLoading(false)
      }
      return
    }

    if (type === 'ESSENCE') {
      setLoading(true)
      try {
        const req = await createRequest(clanId, { type: 'ESSENCE', amount: '1' })
        onCreated([req])
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Ошибка при создании запроса')
      } finally {
        setLoading(false)
      }
      return
    }

    // SERUM
    if (serumTotal === 0) {
      setError('Выберите хотя бы одну сыворотку')
      return
    }
    setLoading(true)
    const toPost = ELEMENTS.filter((e) => serumCounts[e] > 0)
    const results = await Promise.allSettled(
      toPost.map((el) =>
        createRequest(clanId, {
          type: 'SERUM',
          element: el,
          amount: String(serumCounts[el]),
        }),
      ),
    )
    setLoading(false)

    const succeeded: ClanRequestDto[] = []
    const failedElements: Element[] = []
    results.forEach((r, i) => {
      if (r.status === 'fulfilled') {
        succeeded.push(r.value)
      } else {
        failedElements.push(toPost[i])
      }
    })

    if (succeeded.length > 0) {
      onCreated(succeeded)
    }

    if (failedElements.length > 0) {
      const labels = failedElements.join(', ')
      setError(`Не удалось создать запрос для: ${labels}`)
      return
    }
  }

  const submitDisabled =
    loading ||
    (type === 'SLIME' && (slimeCap === 0 || slimePreset === null)) ||
    (type === 'SERUM' && serumTotal === 0)

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 250,
        pointerEvents: 'auto',
        background: 'transparent',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose()
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 'calc(var(--ui-top-offset) + var(--tg-chrome-pad))',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 251,
          pointerEvents: 'none',
          overflow: 'hidden',
        }}
      >
        <div
          className={`ff-panel ${closing ? 'ff-slide-up' : 'ff-slide-down'}`}
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'auto',
            display: 'flex',
            flexDirection: 'column',
            borderRadius: 0,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div
            className="flex items-center gap-1.5 px-3 pt-4 pb-3 flex-shrink-0"
            style={{ borderBottom: '3px dashed rgba(77,107,31,0.4)' }}
          >
            <span className="ff-display flex-1" style={{ fontSize: 20, color: '#2f4a1f' }}>
              Новый запрос
            </span>
            <button
              type="button"
              onClick={handleClose}
              aria-label="Закрыть"
              className="ff-tile w-10 h-10 text-xl flex-shrink-0"
              style={{
                ['--ff-tile-from' as never]: '#fca5a5',
                ['--ff-tile-to' as never]: '#dc2626',
                ['--ff-tile-border' as never]: '#7f1d1d',
                color: '#fff',
              }}
            >
              ✕
            </button>
          </div>

          {/* Content */}
          <div
            className="flex-1 min-h-0 overflow-y-auto ff-no-scrollbar px-4 py-3"
            style={{ WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain' }}
          >
            <div className="flex flex-col gap-4">
              {/* Type selector */}
              <div className="ff-card p-4">
                <div className="text-xs mb-2" style={{ color: '#7a5a2f' }}>Тип запроса</div>
                <div className="flex gap-2">
                  {/* 2026-05-28: SLIME убран — клиент не может создать запрос слизи. */}
                  {(['ESSENCE', 'SERUM'] as ClanRequestType[]).map((t) => (
                    <button
                      key={t}
                      onClick={() => handleTypeChange(t)}
                      className={`ff-btn flex-1 py-1.5 text-xs flex items-center justify-center gap-1 ${type === t ? 'ff-btn-green' : 'ff-btn-grey'}`}
                    >
                      {t === 'SLIME' && <Icon name="slime" size={16} />}
                      {t === 'ESSENCE' && <Icon name="essence" size={16} />}
                      {t === 'SERUM' && (
                        <img
                          src="/genBottle.svg"
                          alt=""
                          style={{ height: 16, width: 'auto', pointerEvents: 'none' }}
                        />
                      )}
                      {t === 'SLIME' ? 'Слизь' : t === 'ESSENCE' ? 'Эссенция' : 'Сыворотка'}
                    </button>
                  ))}
                </div>
              </div>

              {/* SLIME presets */}
              {type === 'SLIME' && (
                <div className="ff-card p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs" style={{ color: '#7a5a2f' }}>Количество</span>
                    {slimeCap === 0 ? (
                      <span className="text-xs" style={{ color: '#92400e' }}>Нужен трактор-доход</span>
                    ) : (
                      <span className="text-xs" style={{ color: '#7a5a2f' }}>
                        Макс: {slimeCap.toLocaleString()}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {SLIME_PRESETS.map((pct, i) => {
                      const amt = Math.floor(slimeCap * pct)
                      return (
                        <button
                          key={pct}
                          disabled={slimeCap === 0}
                          onClick={() => setSlimePreset(pct)}
                          className={`ff-btn flex-1 py-1.5 text-xs flex flex-col items-center gap-0.5 ${slimePreset === pct ? 'ff-btn-green' : 'ff-btn-grey'}`}
                          style={{ opacity: slimeCap === 0 ? 0.4 : 1 }}
                        >
                          <span>{PRESET_LABELS[i]}</span>
                          {slimeCap > 0 && (
                            <span style={{ fontSize: 9, opacity: 0.8 }}>
                              {amt.toLocaleString()}
                            </span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* ESSENCE fixed */}
              {type === 'ESSENCE' && (
                <div className="ff-card p-4">
                  <div className="text-xs mb-2" style={{ color: '#7a5a2f' }}>Количество</div>
                  <div className="flex items-center gap-2">
                    <Icon name="essence" size={20} />
                    <span className="text-sm" style={{ color: '#2f1f0e' }}>1 (фиксировано)</span>
                  </div>
                </div>
              )}

              {/* SERUM multi-select */}
              {type === 'SERUM' && (
                <div className="ff-card p-4">
                  {/* Indicator */}
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs" style={{ color: '#7a5a2f' }}>
                      Выбрано: {serumTotal}/2
                    </span>
                  </div>

                  {/* Selected row */}
                  {selectedSerumElements.length > 0 && (
                    <div className="flex gap-2 mb-3 flex-wrap">
                      {selectedSerumElements.flatMap(({ el, count }) =>
                        Array.from({ length: count }, (_, idx) => (
                          <div
                            key={`${el}-${idx}`}
                            style={{ position: 'relative', display: 'inline-flex' }}
                          >
                            <div
                              style={{
                                width: 36,
                                height: 36,
                                borderRadius: 8,
                                border: `2px solid ${ELEMENT_TINT[el]}`,
                                background: 'rgba(10,10,15,0.75)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              <img
                                src="/genBottle.svg"
                                alt=""
                                style={{
                                  height: 22,
                                  width: 'auto',
                                  filter: ELEMENT_BOTTLE_FILTER[el],
                                  pointerEvents: 'none',
                                }}
                              />
                            </div>
                            <button
                              type="button"
                              onClick={() => handleSerumRemove(el)}
                              aria-label="Убрать"
                              style={{
                                position: 'absolute',
                                top: -6,
                                right: -6,
                                width: 16,
                                height: 16,
                                borderRadius: 99,
                                background: '#dc2626',
                                border: '1px solid #7f1d1d',
                                color: '#fff',
                                fontSize: 9,
                                fontWeight: 700,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                padding: 0,
                                lineHeight: 1,
                              }}
                            >
                              ✕
                            </button>
                          </div>
                        )),
                      )}
                    </div>
                  )}

                  {/* Grid 11 slots */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(4, 52px)',
                      gap: 8,
                      justifyContent: 'start',
                    }}
                  >
                    {ELEMENTS.map((el) => {
                      const cnt = serumCounts[el]
                      const ghost = serumTotal >= 2 && cnt === 0
                      return (
                        <div
                          key={el}
                          onClick={() => !ghost && handleSerumSlotClick(el)}
                          style={{
                            width: 52,
                            height: 56,
                            borderRadius: 10,
                            border: `2px solid ${ELEMENT_TINT[el]}`,
                            background: cnt > 0 ? 'rgba(40,40,55,0.9)' : 'rgba(10,10,15,0.75)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            position: 'relative',
                            cursor: ghost ? 'default' : 'pointer',
                            opacity: ghost ? 0.4 : 1,
                            boxShadow: cnt > 0 ? `0 0 0 2px ${ELEMENT_TINT[el]}, 0 0 10px ${ELEMENT_TINT[el]}aa` : undefined,
                            transition: 'box-shadow .15s, background .15s',
                          }}
                        >
                          <img
                            src="/genBottle.svg"
                            alt=""
                            style={{
                              height: 30,
                              width: 'auto',
                              filter: ELEMENT_BOTTLE_FILTER[el],
                              pointerEvents: 'none',
                            }}
                          />
                          {cnt > 0 && (
                            <span
                              style={{
                                position: 'absolute',
                                top: -6,
                                right: -6,
                                background: '#10b981',
                                color: '#fff',
                                fontSize: 10,
                                fontWeight: 700,
                                borderRadius: 99,
                                minWidth: 18,
                                height: 18,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                padding: '0 4px',
                              }}
                            >
                              {cnt}
                            </span>
                          )}
                        </div>
                      )
                    })}
                  </div>

                  <div className="text-xs mt-2" style={{ color: '#7a5a2f' }}>
                    Можно выбрать до 2 сывороток (одного или разных типов)
                  </div>
                </div>
              )}

              {error && <div className="text-red-500 text-xs px-1">{error}</div>}

              {/* Footer */}
              <div className="flex gap-3 pb-2">
                <button
                  onClick={handleClose}
                  className="ff-btn ff-btn-grey flex-1 py-2 text-sm"
                >
                  Отмена
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={submitDisabled}
                  className="ff-btn ff-btn-amber flex-1 py-2 text-sm"
                  style={{ opacity: submitDisabled ? 0.5 : 1 }}
                >
                  {loading ? 'Создание...' : 'Создать запрос'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
