import { Dialog, Transition } from '@headlessui/react'
import { Fragment } from 'react'
import { X } from 'lucide-react'

interface RedirectModalProps {
  redirectInfo: {
    gameId: string
    gameName: string
    meta: {
      name: string
      imageUrl?: string
      summary?: string
      nexusId?: string | number
      author?: string
    }
    filePath: string
  } | null
  setRedirectInfo: (info: any) => void
  handleSwitchGame: () => void
  handleInstallHere: () => void
  t: any
}

export function RedirectModal({
  redirectInfo,
  setRedirectInfo,
  handleSwitchGame,
  handleInstallHere,
  t
}: RedirectModalProps) {
  if (!redirectInfo) return null

  return (
    <Transition appear show={!!redirectInfo} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={() => setRedirectInfo(null)}>
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
              <Dialog.Panel className="w-full max-w-2xl transform overflow-hidden rounded-2xl glass-panel p-6 text-left align-middle shadow-xl transition-all border border-yellow-500/30 relative">
                <button
                  onClick={() => setRedirectInfo(null)}
                  className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
                <Dialog.Title
                  as="h3"
                  className="text-xl font-bold leading-6 text-yellow-400 mb-2 flex items-center gap-2"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                    className="w-6 h-6"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
                    />
                  </svg>
                  {t.wrongGameDetected}
                </Dialog.Title>

                <div className="mt-2">
                  <p className="text-sm text-gray-300 mb-4">
                    {t.redirectMessage}{' '}
                    <span className="font-bold text-blue-400">{redirectInfo.gameName}</span>.
                  </p>

                  {/* Mod Preview Card */}
                  <div className="flex bg-black/40 rounded-lg overflow-hidden border border-white/10 mb-6">
                    {redirectInfo.meta.imageUrl ? (
                      <div className="w-32 h-32 flex-shrink-0">
                        <img
                          src={redirectInfo.meta.imageUrl}
                          alt="Mod Cover"
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ) : (
                      <div className="w-32 h-32 flex-shrink-0 bg-white/5 flex items-center justify-center">
                        <span className="text-gray-500 text-xs">{t.noImage}</span>
                      </div>
                    )}

                    <div className="p-4 flex flex-col justify-center">
                      <h4 className="font-bold text-lg text-white">{redirectInfo.meta.name}</h4>
                      <p className="text-xs text-gray-400 mt-1 line-clamp-2">
                        {redirectInfo.meta.summary || t.noDescription}
                      </p>

                      <div className="mt-2 flex items-center gap-2">
                        {redirectInfo.meta.author && (
                          <span className="text-xs text-gray-400">
                            {t.byAuthor} {redirectInfo.meta.author}
                          </span>
                        )}
                        {redirectInfo.meta.nexusId && (
                          <span className="text-xs bg-blue-900/50 text-blue-300 px-2 py-0.5 rounded border border-blue-500/20">
                            {t.nexusId}: {redirectInfo.meta.nexusId}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 flex gap-3 justify-end">
                    <button
                      type="button"
                      className="px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm font-medium transition-colors"
                      onClick={handleInstallHere}
                    >
                      {t.installHereAnyway}
                    </button>
                    <button
                      type="button"
                      className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold shadow-lg shadow-blue-500/20 transition-all transform hover:scale-105"
                      onClick={handleSwitchGame}
                    >
                      {t.switchToAndInstall.replace('{game}', redirectInfo.gameName)}
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
