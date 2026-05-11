import { useState } from 'react'
import { COMIC_FRAMES } from './frames'

interface UnlockComicProps {
  locationId: number
  onClose: () => void
}

export function UnlockComic({ locationId, onClose }: UnlockComicProps) {
  const frames = COMIC_FRAMES[locationId]
  const [index, setIndex] = useState(0)

  if (!frames || frames.length === 0) {
    // Защита от вызова с неизвестным locationId — закрываем сразу.
    // Не должно случаться при штатном emit из MergeController.
    queueMicrotask(onClose)
    return null
  }

  const isLast = index >= frames.length - 1
  const handleNext = () => {
    if (isLast) onClose()
    else setIndex((i) => i + 1)
  }

  const frame = frames[index]

  return (
    <div
      className="fixed inset-0 z-[9999] bg-black/80 flex items-center justify-center"
      onClick={handleNext}
    >
      <div className="bg-neutral-900 rounded-2xl p-8 max-w-md mx-4 text-center">
        <div className="text-white text-2xl font-bold mb-6">{frame.text}</div>
        <button
          className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-semibold"
          onClick={(e) => {
            e.stopPropagation()
            handleNext()
          }}
        >
          {isLast ? 'Готово' : 'Дальше'}
        </button>
      </div>
    </div>
  )
}
