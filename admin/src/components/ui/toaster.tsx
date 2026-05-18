import { useToast } from '@/hooks/use-toast'
import { Toast } from './toast'

export function Toaster() {
  const { toasts } = useToast()

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((t) => (
        <Toast key={t.id} {...t} />
      ))}
    </div>
  )
}
