import { Dialog, Transition } from '@headlessui/react'
import { Fragment, useState } from 'react'
import { ShieldAlert, X } from 'lucide-react'

interface AdminPermissionModalProps {
  isOpen: boolean
  onClose: () => void
  onRestartAsAdmin: (alwaysAdmin: boolean) => void
  onContinue: (alwaysAdmin: boolean) => void
  t: any
}

export function AdminPermissionModal({
  isOpen,
  onClose,
  onRestartAsAdmin,
  onContinue,
  t
}: AdminPermissionModalProps) {
  const [alwaysAdmin, setAlwaysAdmin] = useState(false)

  if (!isOpen) return null

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
              <Dialog.Panel className="w-full max-w-lg transform overflow-hidden rounded-2xl glass-panel p-6 text-left align-middle shadow-xl transition-all border border-[rgb(var(--theme-accent))]/30 relative">
                <button
                  onClick={onClose}
                  className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
                <Dialog.Title
                  as="h3"
                  className="text-xl font-bold leading-6 text-white mb-2 flex items-center gap-2"
                >
                  <ShieldAlert className="w-6 h-6 text-yellow-400" />
                  {t.adminRequired || 'Administrator Permissions Recommended'}
                </Dialog.Title>

                <div className="mt-4">
                  <p className="text-gray-300 mb-4">
                    {t.adminRequiredDesc ||
                      'Symlink deployment usually requires Administrator permissions (or Developer Mode) on Windows to function correctly.'}
                  </p>
                  <p className="text-sm text-gray-400 mb-6">
                    {t.adminRequiredDetail ||
                      'Without these permissions, creating symlinks may fail. Would you like to restart Proteus as Administrator?'}
                  </p>

                  <div
                    className="flex items-center gap-3 mb-6 p-3 rounded-lg bg-white/5 border border-white/5 hover:bg-white/10 transition-colors cursor-pointer"
                    onClick={() => setAlwaysAdmin(!alwaysAdmin)}
                  >
                    <div
                      className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${
                        alwaysAdmin
                          ? 'bg-[rgb(var(--theme-accent))] border-[rgb(var(--theme-accent))]'
                          : 'border-gray-500'
                      }`}
                    >
                      {alwaysAdmin && <div className="w-2.5 h-2.5 bg-white rounded-sm" />}
                    </div>
                    <span className="text-sm text-gray-200 select-none">
                      {t.alwaysRunAsAdmin || 'Always Run as Administrator'}
                    </span>
                  </div>

                  <div className="flex gap-3 justify-end">
                    <button
                      onClick={() => onContinue(alwaysAdmin)}
                      className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 transition-colors"
                    >
                      {t.continueAnyway || 'Continue Anyway'}
                    </button>
                    <button
                      onClick={() => onRestartAsAdmin(alwaysAdmin)}
                      className="px-4 py-2 rounded-lg bg-[rgb(var(--theme-accent))] hover:bg-[rgb(var(--theme-accent))]/80 text-white font-medium transition-colors"
                    >
                      {t.restartAsAdmin || 'Restart as Admin'}
                    </button>
                  </div>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  )
}
