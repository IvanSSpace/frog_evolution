import { useEffect, useState, type CSSProperties } from 'react'

type Props = {
  path: string
  tint: number
  alt: string
  className?: string
  style?: CSSProperties
}

// Cache на уровне модуля. Fetch'аем SVG-текст один раз на path; tinted blob URL
// — один раз на (path, tintHex). Это сохраняет цветные элементы (короны, узоры,
// любые non-white fills) — заменяется только `#ffffff` на tint.
const svgTextCache = new Map<string, Promise<string>>()
const tintedUrlCache = new Map<string, string>()

function recolorSvg(svg: string, tintHex: string): string {
  return svg
    .replace(/fill:\s*#ffffff/gi, `fill:${tintHex}`)
    .replace(/fill="#ffffff"/gi, `fill="${tintHex}"`)
    .replace(/fill="#fff"/gi, `fill="${tintHex}"`)
}

async function getTintedUrl(path: string, tintHex: string): Promise<string> {
  const cacheKey = `${path}|${tintHex}`
  const cached = tintedUrlCache.get(cacheKey)
  if (cached) return cached
  if (!svgTextCache.has(path)) {
    svgTextCache.set(path, fetch(path).then((r) => r.text()))
  }
  const text = await svgTextCache.get(path)!
  const recolored = recolorSvg(text, tintHex)
  const blob = new Blob([recolored], { type: 'image/svg+xml' })
  const url = URL.createObjectURL(blob)
  tintedUrlCache.set(cacheKey, url)
  return url
}

export function TintedFrog({ path, tint, alt, className, style }: Props) {
  const tintHex = '#' + tint.toString(16).padStart(6, '0')
  const [src, setSrc] = useState<string | null>(() =>
    tintedUrlCache.get(`${path}|${tintHex}`) ?? null,
  )

  useEffect(() => {
    let cancelled = false
    getTintedUrl(path, tintHex).then((url) => {
      if (!cancelled) setSrc(url)
    })
    return () => {
      cancelled = true
    }
  }, [path, tintHex])

  return (
    <img
      src={src ?? path}
      alt={alt}
      className={className}
      style={{ ...style, visibility: src ? 'visible' : 'hidden' }}
    />
  )
}
