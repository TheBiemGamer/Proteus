import React from 'react'
import { Download, Trash2, ExternalLink, AlertTriangle, RefreshCw, ChevronDown } from 'lucide-react'
import { Game, Mod } from '../types'

const getTypeColor = (type: string) => {
  const t = type.toLowerCase()
  if (t.includes('hotfix')) return 'bg-orange-500/10 text-orange-300 border border-orange-500/20'
  if (t.includes('sdk')) return 'bg-yellow-500/10 text-yellow-300 border border-yellow-500/20'
  if (t.includes('pak')) return 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
  if (t === 'loader' || t === 'binaries')
    return 'bg-purple-500/10 text-purple-300 border border-purple-500/20'
  return 'bg-blue-500/10 text-blue-300 border border-blue-500/20'
}

interface ModListProps {
  mods: Mod[]
  t: any
  gameHealth: any
  currentGame: Game
  setDetailMod: (mod: Mod) => void
  handleCheckUpdate: (mod: Mod) => void
  handleToggleMod: (mod: Mod) => void
  handleDeleteMod: (mod: Mod) => void
  showSourcesMenu: boolean
  setShowSourcesMenu: (show: boolean) => void
  readOnly?: boolean
}

export const ModList: React.FC<ModListProps> = ({
  mods,
  t,
  gameHealth,
  currentGame,
  setDetailMod,
  handleCheckUpdate,
  handleToggleMod,
  handleDeleteMod,
  showSourcesMenu,
  setShowSourcesMenu,
  readOnly = false
}) => {
  return (
    <div className={`space-y-3 pb-10 ${readOnly ? 'pointer-events-none opacity-90' : ''}`}>
      {/* Health Warning Banner */}
      {!gameHealth.valid && (
        <div className="bg-yellow-500/10 border border-yellow-500/20 p-4 rounded-xl flex items-start space-x-4 mb-4">
          <div className="p-2 bg-yellow-500/20 rounded-lg text-yellow-500">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-yellow-200">{t.requirementsMissing}</h3>
            <p className="text-sm text-yellow-200/70 mt-1">
              {gameHealth.message || 'This game requires dependencies that are not installed.'}
            </p>
            {gameHealth.link && !gameHealth.links && (
              <a
                href={gameHealth.link}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center space-x-2 mt-3 text-sm font-medium text-yellow-400 hover:text-yellow-300"
              >
                <span>{gameHealth.linkText || t.downloadRequirement}</span>
                <Download className="w-4 h-4" />
              </a>
            )}
            {gameHealth.links && (
              <div className="flex flex-wrap gap-3 mt-3">
                {gameHealth.links.map((link: any, i: number) => (
                  <a
                    key={i}
                    href={link.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center space-x-2 text-sm font-medium text-yellow-400 hover:text-yellow-300 bg-yellow-400/10 px-3 py-1.5 rounded-lg border border-yellow-400/20 hover:bg-yellow-400/20"
                  >
                    <span>{link.text}</span>
                    <Download className="w-4 h-4" />
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {mods.length === 0 ? (
        <div className="border-2 border-dashed border-white/5 rounded-2xl flex flex-col items-center justify-center h-64 text-[rgb(var(--theme-text-muted))]">
          <p className="font-medium text-white">{t.noMods}</p>
          <p className="text-sm mt-1 text-[rgb(var(--theme-text-muted))]">{t.dragDrop}</p>
        </div>
      ) : (
        mods.map((mod) => (
          <div
            key={mod.id}
            className={`group glass-panel p-4 rounded-xl god-transition hover:scale-[1.01] flex items-center justify-between mb-4 shadow-lg hover:shadow-xl ${
              mod.updateAvailable
                ? 'bg-[rgb(var(--theme-accent))]/5 border border-[rgb(var(--theme-accent))]/30 hover:border-[rgb(var(--theme-accent))]/50'
                : 'bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/10'
            }`}
          >
            <div className="flex items-center space-x-5">
              {/* Status Indicator */}
              <div
                className={`w-1 h-12 rounded-full god-transition ${mod.enabled ? 'bg-[rgb(var(--theme-accent))] shadow-[0_0_15px_rgb(var(--theme-accent))]' : 'bg-white/10'}`}
              ></div>

              {mod.imageUrl && (
                <div className="w-14 h-14 rounded-lg overflow-hidden flex-shrink-0 bg-white/5 border border-white/10">
                  <img src={mod.imageUrl} alt={mod.name} className="w-full h-full object-cover" />
                </div>
              )}

              <div className="flex flex-col flex-1">
                <div className="flex items-center space-x-2">
                  <h3
                    className={`font-bold text-lg ${mod.enabled ? 'text-white' : 'text-[rgb(var(--theme-text-muted))]'} cursor-pointer hover:text-[rgb(var(--theme-accent))] transition-colors`}
                    onClick={() => setDetailMod(mod)}
                  >
                    {mod.name}
                  </h3>
                  {mod.version && (
                    <span className="text-[10px] font-mono bg-white/10 text-[rgb(var(--theme-text-muted))] px-1.5 py-0.5 rounded border border-white/5">
                      {/^\d/.test(mod.version) ? 'v' : ''}
                      {mod.version}
                    </span>
                  )}
                  {mod.updateAvailable && (
                    <span className="text-[10px] font-medium bg-[rgb(var(--theme-accent))]/20 text-[rgb(var(--theme-accent))] px-1.5 py-0.5 rounded border border-[rgb(var(--theme-accent))]/30">
                      Update Available
                    </span>
                  )}
                  {mod.sourceUrl && !mod.sourceUrl.includes('nexusmods.com') && (
                    <>
                      <button
                        onClick={() => (window as any).electron.openUrl(mod.sourceUrl)}
                        className="text-[rgb(var(--theme-text-muted))] hover:text-[rgb(var(--theme-accent))] transition-colors"
                        title={
                          mod.sourceUrl?.includes('github.com') ? 'View on GitHub' : 'View Source'
                        }
                      >
                        <ExternalLink className="w-4 h-4" />
                      </button>
                      {mod.sourceUrl?.includes('github.com') && (
                        <button
                          onClick={() => handleCheckUpdate(mod)}
                          className="text-[rgb(var(--theme-text-muted))] hover:text-emerald-400 transition-colors"
                          title="Check for Updates"
                        >
                          <RefreshCw className="w-4 h-4" />
                        </button>
                      )}
                    </>
                  )}
                  {mod.nexusId && (
                    <>
                      <button
                        onClick={() => {
                          const baseUrl =
                            currentGame?.modSources?.find((s) => s.url.includes('nexusmods.com'))
                              ?.url || 'https://www.nexusmods.com/games'
                          let targetUrl = `${baseUrl}/mods/${mod.nexusId}`

                          // Prefer specific sourceUrl if it's a Nexus link (handles tools like Fluffy on /site/)
                          if (
                            mod.sourceUrl &&
                            mod.nexusId &&
                            mod.sourceUrl.includes('nexusmods.com/') &&
                            mod.sourceUrl.includes(mod.nexusId)
                          ) {
                            targetUrl = mod.sourceUrl
                          }

                          ;(window as any).electron.openUrl(targetUrl)
                        }}
                        className="text-[rgb(var(--theme-text-muted))] hover:text-[rgb(var(--theme-accent))] transition-colors"
                        title="View on Nexus Mods"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleCheckUpdate(mod)}
                        className="text-gray-600 hover:text-green-400 transition-colors"
                        title="Check for Updates"
                      >
                        <RefreshCw className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>

                {mod.note && (
                  <div className="mt-1 text-xs text-yellow-400 font-medium flex items-center space-x-1">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>{mod.note}</span>
                  </div>
                )}

                <div className="flex items-center mt-1 space-x-2">
                  <span
                    className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded ${getTypeColor(mod.type)}`}
                  >
                    {mod.type}
                  </span>
                  {mod.author && mod.author !== 'Unknown' && (
                    <span className="text-xs text-gray-500">by {mod.author}</span>
                  )}
                  {mod.enabled ? (
                    <span className="text-xs text-emerald-500 font-medium flex items-center">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5"></span>
                      Enabled
                    </span>
                  ) : (
                    <span className="text-xs text-gray-500 font-medium">Disabled</span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-6">
              {/* Toggle Switch */}
              <button
                onClick={() => handleToggleMod(mod)}
                className={`relative w-14 h-7 rounded-full p-1 transition-all duration-300 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-black focus:ring-[rgb(var(--theme-accent))] ${
                  mod.enabled
                    ? 'bg-[rgb(var(--theme-accent))] hover:bg-[rgb(var(--theme-accent))]/80'
                    : 'bg-white/10 hover:bg-white/20'
                }`}
              >
                <span
                  className={`block w-5 h-5 bg-white rounded-full shadow-md transform transition-transform duration-300 ease-in-out ${
                    mod.enabled ? 'translate-x-7' : 'translate-x-0'
                  }`}
                />
              </button>

              {/* Delete Button */}
              <button
                onClick={() => handleDeleteMod(mod)}
                className="group/btn p-2 rounded-lg text-gray-500 hover:text-rose-400 hover:bg-rose-400/10 transition-colors"
                title="Delete Mod"
              >
                <Trash2 className="w-5 h-5 transition-transform group-hover/btn:scale-110" />
              </button>
            </div>
          </div>
        ))
      )}

      {currentGame.modSources && currentGame.modSources.length > 0 && (
        <div className="relative mt-4">
          <button
            onClick={() => {
              const sources = currentGame.modSources || []
              if (sources.length === 1) {
                ;(window as any).electron.openUrl(sources[0].url)
              } else {
                setShowSourcesMenu(!showSourcesMenu)
              }
            }}
            className="w-full py-4 bg-[rgb(var(--theme-accent))]/10 hover:bg-[rgb(var(--theme-accent))]/20 border border-[rgb(var(--theme-accent))]/30 hover:border-[rgb(var(--theme-accent))]/50 border-dashed rounded-xl flex items-center justify-center space-x-3 text-[rgb(var(--theme-accent))] hover:text-white god-transition group"
          >
            <Download className="w-5 h-5 fill-current" />
            <span className="font-semibold">
              {currentGame.modSources &&
              currentGame.modSources.length === 1 &&
              currentGame.modSources[0].text
                ? `Get Mods from ${currentGame.modSources[0].text}`
                : t.getMoreMods}
            </span>
            {currentGame.modSources && currentGame.modSources.length > 1 && (
              <ChevronDown
                className={`w-4 h-4 transition-transform ${showSourcesMenu ? 'rotate-180' : 'group-hover:translate-x-1'}`}
              />
            )}
          </button>

          {/* Dropdown Menu */}
          {showSourcesMenu && (
            <div className="absolute bottom-full left-0 w-full mb-2 bg-[#1a1c23] border border-gray-700 rounded-xl shadow-2xl overflow-hidden z-20">
              {currentGame.modSources?.map((source, idx) => (
                <button
                  key={idx}
                  onClick={() => (window as any).electron.openUrl(source.url)}
                  className="w-full text-left px-4 py-3 hover:bg-[rgb(var(--theme-accent))]/10 hover:text-[rgb(var(--theme-accent))] text-gray-300 transition-colors flex items-center space-x-3 border-b border-gray-800 last:border-0"
                >
                  <span className="font-medium">{source.text}</span>
                  <span className="text-xs text-gray-600 truncate ml-auto max-w-[150px]">
                    {source.url.replace(/^https?:\/\//, '')}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
