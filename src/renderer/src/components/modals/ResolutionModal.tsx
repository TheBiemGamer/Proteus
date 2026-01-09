import { Dialog, Transition } from '@headlessui/react'
import { Fragment } from 'react'
import { X, AlertTriangle } from 'lucide-react'

interface ActionButton {
  label: string
  onClick: () => void
  variant?: 'primary' | 'danger' | 'secondary'
}

interface ResolutionModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  message: string
  actions: ActionButton[]
}

export function ResolutionModal({
  isOpen,
  onClose,
  title,
  message,
  actions
}: ResolutionModalProps) {
  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel
                className="w-full max-w-md transform overflow-hidden rounded-2xl glass-panel p-6 text-left align-middle shadow-xl transition-all border relative"
                style={{ borderColor: 'rgba(var(--theme-accent), 0.3)' }}
              >
                <button
                  onClick={onClose}
                  className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>

                <Dialog.Title
                  as="h3"
                  className="text-xl font-bold leading-6 mb-2 flex items-center gap-2"
                  style={{ color: 'rgb(var(--theme-accent))' }}
                >
                  <AlertTriangle className="w-6 h-6" />
                  {title}
                </Dialog.Title>

                <div className="mt-4">
                  <p className="text-sm text-gray-300 whitespace-pre-wrap">{message}</p>
                </div>

                <div className="mt-8 flex gap-3 justify-end items-center flex-wrap">
                  {actions.map((action, idx) => (
                    <button
                      key={idx}
                      type="button"
                      className={`px-4 py-2 rounded-lg text-sm font-bold transition-all transform hover:scale-105 shadow-lg ${
                        action.variant === 'danger'
                          ? 'bg-red-600 hover:bg-red-500 text-white shadow-red-500/20'
                          : action.variant === 'secondary'
                          ? 'bg-gray-700 hover:bg-gray-600 text-gray-200'
                          : 'text-white'
                      }`}
                      style={
                        action.variant === 'primary'
                          ? {
                              backgroundColor: 'rgb(var(--theme-accent))',
                              boxShadow: '0 4px 14px 0 rgba(var(--theme-accent), 0.39)'
                            }
                          : {}
                      }
                      onClick={action.onClick}
                    >
                      {action.label}
                    </button>
                  ))}
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  )
}