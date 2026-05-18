import { cn } from '@/lib/utils'

type ToastProps = {
  id: string
  title: string
  description?: string
  variant?: 'default' | 'destructive'
}

export function Toast({ title, description, variant }: ToastProps) {
  return (
    <div
      className={cn(
        'pointer-events-auto flex w-full max-w-sm rounded-lg border p-4 shadow-lg',
        variant === 'destructive'
          ? 'border-destructive bg-destructive text-destructive-foreground'
          : 'border-border bg-card text-card-foreground',
      )}
    >
      <div className="flex flex-col gap-1">
        <p className="text-sm font-semibold">{title}</p>
        {description && <p className="text-sm opacity-90">{description}</p>}
      </div>
    </div>
  )
}
