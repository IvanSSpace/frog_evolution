import * as React from 'react'

type ToastType = 'default' | 'destructive'

type Toast = {
  id: string
  title: string
  description?: string
  variant?: ToastType
}

type ToastState = {
  toasts: Toast[]
}

const listeners: Array<(state: ToastState) => void> = []
let memoryState: ToastState = { toasts: [] }

function dispatch(action: { type: 'ADD' | 'REMOVE'; toast?: Toast; id?: string }) {
  if (action.type === 'ADD' && action.toast) {
    memoryState = { toasts: [action.toast, ...memoryState.toasts].slice(0, 5) }
  } else if (action.type === 'REMOVE') {
    memoryState = { toasts: memoryState.toasts.filter((t) => t.id !== action.id) }
  }
  listeners.forEach((l) => l(memoryState))
}

export function toast(props: Omit<Toast, 'id'>) {
  const id = Math.random().toString(36).slice(2)
  dispatch({ type: 'ADD', toast: { ...props, id } })
  setTimeout(() => dispatch({ type: 'REMOVE', id }), 4000)
}

export function useToast() {
  const [state, setState] = React.useState(memoryState)

  React.useEffect(() => {
    listeners.push(setState)
    return () => {
      const idx = listeners.indexOf(setState)
      if (idx > -1) listeners.splice(idx, 1)
    }
  }, [])

  return { toasts: state.toasts, toast }
}
