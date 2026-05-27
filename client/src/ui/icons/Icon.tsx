// Icon — рендерит SVG/PNG из public/icons/<name>.svg, с emoji-fallback пока
// файла нет (img onError → эмодзи). Drop ассет с правильным именем → красиво.
//
// Использование: <Icon name="ship" size={26} />

import { useState, type CSSProperties } from 'react'
import { ICON_EMOJI, iconSrc, type IconName } from './iconRegistry'

interface Props {
  name: IconName
  /** Размер в px (квадрат). По умолчанию 24. */
  size?: number
  className?: string
  style?: CSSProperties
  /** Доп. класс/aria. */
  title?: string
}

export function Icon({ name, size = 24, className, style, title }: Props) {
  const [failed, setFailed] = useState(false)

  if (failed) {
    return (
      <span
        className={className}
        title={title}
        aria-hidden={title ? undefined : true}
        style={{
          fontSize: size,
          lineHeight: 1,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          ...style,
        }}
      >
        {ICON_EMOJI[name]}
      </span>
    )
  }

  return (
    <img
      src={iconSrc(name)}
      width={size}
      height={size}
      alt={title ?? ''}
      title={title}
      draggable={false}
      onError={() => setFailed(true)}
      className={className}
      style={{
        width: size,
        height: size,
        objectFit: 'contain',
        display: 'inline-block',
        ...style,
      }}
    />
  )
}
