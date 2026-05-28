import { buildFrog, type EmblemStyle } from '../../utils/frogEmblem'

export interface FrogEmblemProps {
  variant: number
  style: EmblemStyle
  bg: string
  frog: string
  topColor?: string
  stripeColor?: string
  size?: number
  className?: string
}

export function FrogEmblem({ variant, style, bg, frog, topColor, stripeColor, size = 64, className }: FrogEmblemProps) {
  const inner = buildFrog(variant, bg, frog, { bgStyle: style, topColor, stripeColor })
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 400 400"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      dangerouslySetInnerHTML={{ __html: inner }}
    />
  )
}
