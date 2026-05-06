type Props = {
  path: string
  tint: number
  alt: string
  className?: string
  style?: React.CSSProperties
}

export function TintedFrog({ path, tint, alt, className, style }: Props) {
  const hex = tint.toString(16).padStart(6, '0')
  const id = `tf-${hex}`
  const r = ((tint >> 16) & 0xff) / 255
  const g = ((tint >> 8)  & 0xff) / 255
  const b = ( tint        & 0xff) / 255
  const matrix = `${r} 0 0 0 0  0 ${g} 0 0 0  0 0 ${b} 0 0  0 0 0 1 0`

  // Prepend the tint filter; extra filter functions from style are appended after
  const extraFilter = style?.filter as string | undefined
  const filterValue = extraFilter ? `url(#${id}) ${extraFilter}` : `url(#${id})`

  return (
    <>
      <svg width={0} height={0} style={{ position: 'absolute', overflow: 'hidden' }}>
        <defs>
          <filter id={id} colorInterpolationFilters="sRGB">
            <feColorMatrix type="matrix" values={matrix} />
          </filter>
        </defs>
      </svg>
      <img
        src={path}
        alt={alt}
        className={className}
        style={{ ...style, filter: filterValue }}
      />
    </>
  )
}
