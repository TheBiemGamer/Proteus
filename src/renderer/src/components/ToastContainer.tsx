import { X, CheckCircle, AlertTriangle, Info } from 'lucide-react'

export interface Toast {
  id: number
  message: string
  type: 'success' | 'error' | 'info' | 'warning'
}

export function ToastContainer({
  toasts,
  removeToast
}: {
  toasts: Toast[]
  removeToast: (id: number) => void
}) {
  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col space-y-2 pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`
            pointer-events-auto transform transition-all duration-300 ease-out translate-x-0 opacity-100 flex items-center p-4 rounded-lg shadow-lg min-w-[300px] border
            ${
              toast.type === 'success'
                ? 'bg-gray-900/95 border-emerald-500/50 text-emerald-100'
                : toast.type === 'error'
                  ? 'bg-gray-900/95 border-rose-500/50 text-rose-100'
                  : toast.type === 'warning'
                    ? 'bg-gray-900/95 border-yellow-500/50 text-yellow-100'
                    : 'bg-gray-900/95 border-blue-500/50 text-blue-100'
            }
          `}
        >
          <div className="mr-3">
            {toast.type === 'success' && <CheckCircle className="w-5 h-5 text-emerald-500" />}
            {toast.type === 'error' && <AlertTriangle className="w-5 h-5 text-rose-500" />}
            {toast.type === 'warning' && <AlertTriangle className="w-5 h-5 text-yellow-500" />}
            {toast.type === 'info' && <Info className="w-5 h-5 text-blue-500" />}
          </div>
          <div className="flex-1 text-sm font-medium">{toast.message}</div>
          <button
            onClick={() => removeToast(toast.id)}
            className="ml-3 text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  )
}
