import React from 'react'
import { X, Box, Puzzle } from 'lucide-react'

interface PluginInstallModalProps {
  pluginPreview: {
    meta: {
      name?: string
      version?: string
      author?: string
      description?: string
      iconUrl?: string
      id?: string
    }
    filePath: string
  }
  setPluginPreview: (val: any | null) => void
  handleInstallPluginConfirm: () => void
  isManaging: boolean
  t: any
}

export const PluginInstallModal: React.FC<PluginInstallModalProps> = ({
  pluginPreview,
  setPluginPreview,
  handleInstallPluginConfirm,
  isManaging,
  t
}) => {
  const { meta } = pluginPreview
  const displayName = meta.name || 'Unknown Plugin'
  const displayAuthor = meta.author || 'Unknown Author'
  const displayVersion = meta.version || '1.0.0'

  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 god-transition animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) setPluginPreview(null)
      }}
    >
      <div
        className="glass-panel rounded-2xl p-0 w-full max-w-lg shadow-2xl overflow-hidden flex flex-col god-transition animate-in zoom-in-95 duration-300 border relative"
        style={{ borderColor: 'rgba(var(--theme-accent), 0.3)' }}
      >
        <button
          onClick={() => setPluginPreview(null)}
          className="absolute top-4 right-4 z-20 text-gray-400 hover:text-white transition-colors bg-black/20 p-1 rounded-full backdrop-blur-sm"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="p-8 border-b border-white/10 flex-shrink-0 bg-gradient-to-br from-white/5 to-transparent">
          <div className="flex items-start gap-5">
            <div className="w-20 h-20 rounded-2xl overflow-hidden shadow-lg border border-white/10 bg-black/20 flex-shrink-0 flex items-center justify-center">
              {meta.iconUrl ? (
                <img src={meta.iconUrl} alt={displayName} className="w-full h-full object-cover" />
              ) : (
                <Puzzle className="w-10 h-10 text-gray-500" />
              )}
            </div>
            <div className="flex-1 min-w-0 pt-1">
              <h2
                className="text-2xl font-bold truncate mb-1"
                style={{ color: 'rgb(var(--theme-accent))' }}
              >
                {displayName}
              </h2>
              <div className="flex items-center space-x-2">
                <span className="text-gray-400 text-sm">
                  v{displayVersion} by {displayAuthor}
                </span>
              </div>
              {meta.id && (
                <div className="mt-2 inline-block px-2 py-0.5 rounded text-xs bg-black/30 text-gray-500 font-mono border border-white/5">
                  ID: {meta.id}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="p-6 flex-1 overflow-y-auto">
          <h4 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">
            Description
          </h4>
          <div className="bg-black/20 p-4 rounded-xl border border-white/5 min-h-[100px]">
            <p className="text-gray-300 whitespace-pre-wrap text-sm leading-relaxed">
              {meta.description || 'No description provided.'}
            </p>
          </div>

          <div className="mt-6 flex items-start gap-3 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
             <div className="text-blue-400 mt-0.5">
               <Box className="w-5 h-5" />
             </div>
             <div className="text-sm text-gray-300">
               <p>Installing this extension will verify game support.</p>
               <p className="text-xs text-gray-500 mt-1">File: {pluginPreview.filePath}</p>
             </div>
          </div>
        </div>

        <div className="p-6 border-t border-white/10 bg-black/20 flex justify-end space-x-3 flex-shrink-0">
          <button
            onClick={() => setPluginPreview(null)}
            className="px-4 py-2 text-gray-400 hover:text-white god-transition"
          >
            {t.cancel}
          </button>
          <button
            onClick={handleInstallPluginConfirm}
            className="px-6 py-2 text-white rounded-xl shadow-lg font-semibold flex items-center space-x-2 god-transition"
            style={{
              backgroundColor: 'rgb(var(--theme-accent))',
              boxShadow: '0 4px 14px 0 rgba(var(--theme-accent), 0.39)'
            }}
          >
            {isManaging ? <span>{t.installing || 'Installing...'}</span> : <span>Install Extension</span>}
          </button>
        </div>
      </div>
    </div>
  )
}
