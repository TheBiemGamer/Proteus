import React from 'react'
import { Game } from '../../types'

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
  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 god-transition animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) setPreviewModpack(null)
      }}
    >
      <div className="glass-panel border border-white/10 rounded-2xl p-0 w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] god-transition animate-in zoom-in-95 duration-300">
        {previewModpack.image && (
          <div className="h-48 w-full bg-black/40 relative">
            <img src={previewModpack.image} className="w-full h-full object-cover opacity-60" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#09090b] to-transparent" />
            <div className="absolute bottom-4 left-6">
              <h2 className="text-3xl font-bold text-white shadow-sm">
                {previewModpack.meta.title}
              </h2>
              <div className="flex items-center space-x-2 text-[rgb(var(--theme-accent))]/80 mt-1">
                <span className="font-semibold px-2 py-0.5 rounded bg-black/40 border border-white/10 text-xs uppercase tracking-wider text-white">
                  {games.find((g) => g.id === previewModpack.meta.gameId)?.name ||
                    previewModpack.meta.gameId}
                </span>
                <span>
                  {/^\d/.test(previewModpack.meta.version) ? 'v' : ''}
                  {previewModpack.meta.version} by {previewModpack.meta.author}
                </span>
              </div>
            </div>
          </div>
        )}
        {!previewModpack.image && (
          <div className="p-8 border-b border-white/10">
            <h2 className="text-3xl font-bold text-white">{previewModpack.meta.title}</h2>
            <div className="flex items-center space-x-2 text-[rgb(var(--theme-accent))]/80 mt-3">
              <span className="font-semibold px-2 py-0.5 rounded bg-[rgb(var(--theme-accent))]/20 border border-[rgb(var(--theme-accent))]/30 text-[rgb(var(--theme-accent))] text-xs uppercase tracking-wider">
                {games.find((g) => g.id === previewModpack.meta.gameId)?.name ||
                  previewModpack.meta.gameId}
              </span>
              <span>
                {/^\d/.test(previewModpack.meta.version) ? 'v' : ''}
                {previewModpack.meta.version} by {previewModpack.meta.author}
              </span>
            </div>
          </div>
        )}

        <div className="p-6 flex-1 overflow-y-auto">
          <p className="text-gray-300 mb-6 whitespace-pre-wrap">
            {previewModpack.meta.description}
          </p>

          <h4 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">
            {t.modsIncluded} ({previewModpack.mods.length})
          </h4>
          <div className="bg-black/20 rounded-xl p-2 max-h-40 overflow-y-auto border border-white/10 custom-scrollbar">
            {previewModpack.mods.map((m: any) => (
              <div
                key={m.id}
                className="flex justify-between items-center p-2 text-sm border-b border-white/5 last:border-0 hover:bg-white/5 rounded god-transition"
              >
                <span className="text-gray-300">{m.name}</span>
                <span className="text-gray-600 font-mono text-xs">{m.version}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="p-6 border-t border-white/10 bg-black/20 flex justify-end space-x-3">
          <button
            onClick={() => setPreviewModpack(null)}
            className="px-4 py-2 text-gray-400 hover:text-white god-transition"
          >
            {t.cancel}
          </button>
          <button
            onClick={handleInstallModpackConfirm}
            className="px-6 py-2 bg-[rgb(var(--theme-accent))] hover:bg-[rgb(var(--theme-accent))]/80 text-white rounded-xl shadow-lg shadow-[rgb(var(--theme-accent))]/20 font-semibold flex items-center space-x-2 god-transition"
          >
            {isManaging ? <span>{t.installing}</span> : <span>{t.installPack}</span>}
          </button>
        </div>
      </div>
    </div>
  )
}
