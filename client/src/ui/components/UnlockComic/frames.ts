// Placeholder контент для UnlockComic. Финальные кадры (текст + картинки)
// будут добавлены автором отдельной задачей; сейчас один кадр на локацию.

export type ComicFrame = {
  text: string
  imageUrl?: string // зарезервировано для будущих финальных кадров
}

export const COMIC_FRAMES: Readonly<Record<number, ComicFrame[]>> = {
  2: [{ text: 'Лес открыт' }],
  3: [{ text: 'Континент открыт' }],
  4: [{ text: 'Планета открыта' }],
  6: [{ text: 'Звёздная карта открыта' }],
} as const
