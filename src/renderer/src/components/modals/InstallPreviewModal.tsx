import React from 'react'
import { AlertTriangle } from 'lucide-react'
import { IAppSettings } from '../../../../shared/types'

interface InstallPreviewModalProps {
  installPreview: { file: string; meta: any }
  setInstallPreview: (preview: { file: string; meta: any } | null) => void
  confirmModInstall: () => void
  isManaging: boolean
  settings: IAppSettings
}

export const InstallPreviewModal: React.FC<InstallPreviewModalProps> = ({
  installPreview,
  setInstallPreview,
  confirmModInstall,
  isManaging,
  settings
}) => {
  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 god-transition animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) setInstallPreview(null)
      }}
    >
      <div className="glass-panel border border-white/10 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] god-transition animate-in zoom-in-95 duration-300">
        <div className="relative">
          {installPreview.meta.imageUrl ? (
            <div className="h-40 w-full relative">
              <div className="absolute inset-0 bg-gradient-to-t from-gray-950 via-gray-900/40 to-transparent z-10" />
              <img
                src={installPreview.meta.imageUrl}
                alt="Mod Cover"
                className="w-full h-full object-cover"
              />
              <div className="absolute bottom-4 left-6 z-20">
                <h2 className="text-3xl font-bold text-white leading-none shadow-black drop-shadow-md">
                  {installPreview.meta.name || 'Unknown Mod'}
                </h2>
              </div>
            </div>
          ) : (
            <div className="p-6 pb-2 bg-gradient-to-r from-[rgb(var(--theme-bg-start))] to-[rgb(var(--theme-bg-end))] border-b border-white/10">
              <h2 className="text-2xl font-bold text-white">
                {installPreview.meta.name || installPreview.file.split(/[\\/]/).pop()}
              </h2>
            </div>
          )}
        </div>

        <div className="p-6 flex-1 overflow-y-auto space-y-4">
          {installPreview.meta.nexusId && !settings.nexusApiKey && (
            <div className="bg-yellow-900/20 border border-yellow-700/50 rounded-lg p-3 flex items-center space-x-3 text-yellow-200">
              <AlertTriangle className="w-5 h-5 text-yellow-500 flex-shrink-0" />
              <div className="text-xs">
                <span className="font-bold block text-yellow-400">Missing Nexus API Key</span>
                Metadata and cover image could not be fetched. Add your API key in Settings for full
                details.
              </div>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <span className="px-2 py-1 bg-white/5 rounded text-xs text-gray-400 border border-white/10">
              {/^\d/.test(installPreview.meta.version || '') ? 'v' : ''}
              {installPreview.meta.version || '?.?.?'}
            </span>
            <span className="px-2 py-1 bg-white/5 rounded text-xs text-blue-400 border border-white/10">
              {installPreview.meta.author || 'Unknown Author'}
            </span>
            {installPreview.meta.nexusId && (
              <span className="px-2 py-1 bg-orange-900/40 text-orange-400 rounded text-xs border border-orange-700/40">
                NexusMods: {installPreview.meta.nexusId}
              </span>
            )}
          </div>

          <p className="text-gray-300 whitespace-pre-wrap leading-relaxed">
            {installPreview.meta.description || 'No description available.'}
          </p>
        </div>

        <div className="p-6 border-t border-white/10 bg-black/20 flex justify-end space-x-3">
          <button
            onClick={() => setInstallPreview(null)}
            className="px-4 py-2 text-gray-400 hover:text-white god-transition"
          >
            Cancel
          </button>
          <button
            onClick={confirmModInstall}
            disabled={isManaging}
            className="px-6 py-2 bg-[rgb(var(--theme-accent))] hover:bg-[rgb(var(--theme-accent))]/80 text-white rounded-xl shadow-lg shadow-[rgb(var(--theme-accent))]/20 font-semibold god-transition"
          >
            {isManaging ? 'Installing...' : 'Install Mod'}
          </button>
        </div>
      </div>
    </div>
  )
}
