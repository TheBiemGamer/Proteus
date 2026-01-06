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
            pointer-events-auto transform god-transition translate-x-0 opacity-100 flex items-center p-4 rounded-xl shadow-2xl min-w-[300px] border backdrop-blur-md
            ${
              toast.type === 'success'
                ? 'bg-emerald-950/80 border-emerald-500/30 text-emerald-100 shadow-emerald-900/20'
                : toast.type === 'error'
                  ? 'bg-rose-950/80 border-rose-500/30 text-rose-100 shadow-rose-900/20'
                  : toast.type === 'warning'
                    ? 'bg-yellow-950/80 border-yellow-500/30 text-yellow-100 shadow-yellow-900/20'
                    : 'bg-blue-950/80 border-blue-500/30 text-blue-100 shadow-blue-900/20'
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
