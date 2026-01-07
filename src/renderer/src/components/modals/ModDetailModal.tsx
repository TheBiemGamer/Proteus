import React from 'react'
import { ExternalLink } from 'lucide-react'
import { Game, Mod } from '../../types'

interface ModDetailModalProps {
  detailMod: Mod
  setDetailMod: (mod: Mod | null) => void
  handleUninstallDetailMod: () => void
  handleToggleDetailMod: () => void
  currentGame: Game
}

export const ModDetailModal: React.FC<ModDetailModalProps> = ({
  detailMod,
  setDetailMod,
  handleUninstallDetailMod,
  handleToggleDetailMod,
  currentGame
}) => {
  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 god-transition animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) setDetailMod(null)
      }}
    >
      <div className="glass-panel border border-white/10 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] god-transition animate-in zoom-in-95 duration-300">
        <div className="relative">
          {detailMod.imageUrl ? (
            <div className="h-40 w-full relative group">
              <div className="absolute inset-0 bg-gradient-to-t from-gray-950 via-gray-900/40 to-transparent z-10" />
              <img
                src={detailMod.imageUrl}
                alt="Mod Cover"
                className="w-full h-full object-cover"
                onError={(e) => {
                  ;(e.target as HTMLImageElement).style.display = 'none'
                  // Fallback logic could go here if needed
                }}
              />
              <div className="absolute bottom-4 left-6 z-20">
                <h2 className="text-3xl font-bold text-white leading-none shadow-black drop-shadow-md">
                  {detailMod.name}
                </h2>
              </div>
            </div>
          ) : (
            <div className="p-6 pb-2 bg-gradient-to-r from-[rgb(var(--theme-bg-start))] to-[rgb(var(--theme-bg-end))] border-b border-white/10">
              <h2 className="text-2xl font-bold text-white">{detailMod.name}</h2>
            </div>
          )}

          <button
            className="absolute top-4 right-4 z-30 p-2 bg-black/50 hover:bg-black/70 rounded-full text-white god-transition"
            onClick={() => setDetailMod(null)}
          >
            ✕
          </button>
        </div>

        <div className="p-6 flex-1 overflow-y-auto space-y-4">
          <div className="flex flex-wrap gap-2">
            <span className="px-2 py-1 bg-white/5 rounded text-xs text-gray-400 border border-white/10">
              v{detailMod.version || '?.?.?'}
            </span>
            <span className="px-2 py-1 bg-white/5 rounded text-xs text-blue-400 border border-white/10">
              {detailMod.author || 'Unknown Author'}
            </span>
            <span
              className={`px-2 py-1 rounded text-xs border ${detailMod.enabled ? 'bg-emerald-900/20 text-emerald-400 border-emerald-900' : 'bg-red-900/20 text-red-400 border-red-900'}`}
            >
              {detailMod.enabled ? 'Enabled' : 'Disabled'}
            </span>
          </div>

          <p className="text-gray-300 whitespace-pre-wrap leading-relaxed">
            {detailMod.description || 'No description available.'}
          </p>
        </div>

        <div className="p-6 border-t border-white/10 bg-black/20 flex justify-between items-center">
          <button
            onClick={handleUninstallDetailMod}
            className="px-4 py-2 text-rose-400 hover:text-rose-300 hover:bg-rose-900/20 rounded-xl transition-colors god-transition"
          >
            Uninstall
          </button>
          <div className="flex space-x-3">
            {detailMod.nexusId && (
              <button
                onClick={() => {
                  const nexusId = detailMod.nexusId
                  if (!nexusId) return

                  const baseUrl =
                    currentGame?.modSources?.find((s) => s.url.includes('nexusmods.com'))?.url ||
                    'https://www.nexusmods.com/games'
                  let targetUrl = `${baseUrl}/mods/${nexusId}`

                  if (
                    detailMod.sourceUrl &&
                    detailMod.sourceUrl.includes('nexusmods.com/') &&
                    detailMod.sourceUrl.includes(nexusId)
                  ) {
                    targetUrl = detailMod.sourceUrl
                  }

                  ;(window as any).electron.openUrl(targetUrl)
                }}
                className="px-4 py-2 bg-white/5 hover:bg-white/10 text-gray-200 rounded-xl font-medium border border-white/5 flex items-center space-x-2 god-transition"
              >
                <ExternalLink className="w-4 h-4" />
                <span>Nexus Mods</span>
              </button>
            )}
            {detailMod.sourceUrl && !detailMod.sourceUrl.includes('nexusmods.com') && (
              <button
                onClick={() => (window as any).electron.openUrl(detailMod.sourceUrl)}
                className="px-4 py-2 bg-white/5 hover:bg-white/10 text-gray-200 rounded-xl font-medium border border-white/5 flex items-center space-x-2 god-transition"
              >
                <ExternalLink className="w-4 h-4" />
                <span>Source</span>
              </button>
            )}
            <button
              onClick={handleToggleDetailMod}
              className={`px-6 py-2 rounded-xl font-semibold shadow-lg god-transition ${detailMod.enabled ? 'bg-gray-700 hover:bg-gray-600 text-gray-200' : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-900/20'}`}
            >
              {detailMod.enabled ? 'Disable' : 'Enable'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
