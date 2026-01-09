import React from 'react'
import { Game } from '../../types'
import { X, Box } from 'lucide-react'

interface PreviewModpackModalProps {
  previewModpack: any
  setPreviewModpack: (pack: any | null) => void
  handleInstallModpackConfirm: () => void
  isManaging: boolean
  t: any
  games: Game[]
}

export const PreviewModpackModal: React.FC<PreviewModpackModalProps> = ({
  previewModpack,
  setPreviewModpack,
  handleInstallModpackConfirm,
  isManaging,
  t,
  games
}) => {
  const game = games.find((g) => g.id === previewModpack.meta.gameId)

  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 god-transition animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) setPreviewModpack(null)
      }}
    >
      <div
        className="glass-panel rounded-2xl p-0 w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] god-transition animate-in zoom-in-95 duration-300 border relative"
        style={{ borderColor: 'rgba(var(--theme-accent), 0.3)' }}
      >
        <button
          onClick={() => setPreviewModpack(null)}
          className="absolute top-4 right-4 z-20 text-gray-400 hover:text-white transition-colors bg-black/20 p-1 rounded-full backdrop-blur-sm"
        >
          <X className="w-5 h-5" />
        </button>

        {previewModpack.image ? (
          <div className="h-48 w-full bg-black/40 relative flex-shrink-0">
            <img src={previewModpack.image} className="w-full h-full object-cover opacity-80" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#09090b] to-transparent" />

            {game?.iconUrl && (
              <div className="absolute top-4 left-6 w-12 h-12 rounded-lg overflow-hidden shadow-xl border border-white/20 bg-black/50 backdrop-blur-md z-10">
                <img src={game.iconUrl} alt={game.name} className="w-full h-full object-cover" />
              </div>
            )}

            <div className="absolute bottom-4 left-6 right-6">
              <h2 className="text-3xl font-bold text-white shadow-sm truncate">
                {previewModpack.meta.title}
              </h2>
              <div className="flex items-center space-x-2 mt-2">
                <span
                  className="font-semibold px-2 py-0.5 rounded text-xs uppercase tracking-wider text-white border border-white/20 backdrop-blur-md"
                  style={{ backgroundColor: 'rgba(var(--theme-accent), 0.4)' }}
                >
                  {game?.name || previewModpack.meta.gameId}
                </span>
                <span className="text-gray-300 text-sm shadow-sm">
                  {/^\d/.test(previewModpack.meta.version) ? 'v' : ''}
                  {previewModpack.meta.version} by {previewModpack.meta.author}
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-8 border-b border-white/10 flex-shrink-0">
            <div className="flex items-start gap-5">
              {game?.iconUrl && (
                <div className="w-16 h-16 rounded-xl overflow-hidden shadow-lg border border-white/10 bg-black/20 flex-shrink-0">
                  <img src={game.iconUrl} alt={game.name} className="w-full h-full object-cover" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <h2
                  className="text-3xl font-bold truncate"
                  style={{ color: 'rgb(var(--theme-accent))' }}
                >
                  {previewModpack.meta.title}
                </h2>
                <div className="flex items-center space-x-2 mt-3">
                  <span
                    className="font-semibold px-2 py-0.5 rounded text-xs uppercase tracking-wider text-white flex-shrink-0"
                    style={{ backgroundColor: 'rgb(var(--theme-accent))' }}
                  >
                    {game?.name || previewModpack.meta.gameId}
                  </span>
                  <span className="text-gray-400 text-sm truncate">
                    {/^\d/.test(previewModpack.meta.version) ? 'v' : ''}
                    {previewModpack.meta.version} by {previewModpack.meta.author}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="p-6 flex-1 overflow-y-auto custom-scrollbar">
          {previewModpack.meta.description && (
            <p className="text-gray-300 mb-6 whitespace-pre-wrap text-sm leading-relaxed bg-black/20 p-4 rounded-xl border border-white/5">
              {previewModpack.meta.description}
            </p>
          )}

          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-bold text-gray-500 uppercase tracking-wider">
              {t.modsIncluded} ({previewModpack.mods.length})
            </h4>
          </div>

          <div className="bg-black/20 rounded-xl p-2 border border-white/10">
            {previewModpack.mods.map((m: any) => (
              <div
                key={m.id}
                className="flex items-center p-3 border-b border-white/5 last:border-0 hover:bg-white/5 rounded-lg god-transition space-x-3 group"
              >
                <div className="w-10 h-10 rounded bg-black/40 overflow-hidden flex-shrink-0 border border-white/10 flex items-center justify-center">
                  {m.imageUrl ? (
                    <img src={m.imageUrl} className="w-full h-full object-cover" />
                  ) : (
                    <Box className="w-5 h-5 text-gray-600" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-baseline">
                    <span className="text-gray-200 font-medium truncate group-hover:text-white transition-colors">
                      {m.name}
                    </span>
                    <span className="text-gray-500 font-mono text-xs ml-2">{m.version}</span>
                  </div>
                  {m.author && <p className="text-xs text-gray-500 truncate">by {m.author}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="p-6 border-t border-white/10 bg-black/20 flex justify-end space-x-3 flex-shrink-0">
          <button
            onClick={() => setPreviewModpack(null)}
            className="px-4 py-2 text-gray-400 hover:text-white god-transition"
          >
            {t.cancel}
          </button>
          <button
            onClick={handleInstallModpackConfirm}
            className="px-6 py-2 text-white rounded-xl shadow-lg font-semibold flex items-center space-x-2 god-transition"
            style={{
              backgroundColor: 'rgb(var(--theme-accent))',
              boxShadow: '0 4px 14px 0 rgba(var(--theme-accent), 0.39)'
            }}
          >
            {isManaging ? <span>{t.installing}</span> : <span>{t.installPack}</span>}
          </button>
        </div>
      </div>
    </div>
  )
}