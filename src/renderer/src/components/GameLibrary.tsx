import React, { useState } from 'react'
import { Gamepad2, Download, FolderOpen, Box, Loader2 } from 'lucide-react'
import { Game, Mod } from '../types'
import { ModList } from './ModList'

interface GameLibraryProps {
  currentGame: Game
  mods: Mod[]
  isManaging: boolean
  gameHealth: any
  t: any
  handleManageGame: () => Promise<void>
  handleUnmanageGame: () => Promise<void>
  handleDisableAll: () => Promise<void>
  handleEnableAll: () => Promise<void>
  handleInstallMod: () => Promise<void>
  setDetailMod: (mod: Mod) => void
  handleCheckUpdate: (mod: Mod) => Promise<void>
  handleToggleMod: (mod: Mod) => Promise<void>
  handleDeleteMod: (mod: Mod) => Promise<void>
  showSourcesMenu: boolean
  setShowSourcesMenu: (val: boolean) => void
  readOnly?: boolean
  addToast: (message: string | React.ReactNode, type?: 'success' | 'error' | 'info' | 'warning') => void
}

export const GameLibrary: React.FC<GameLibraryProps> = ({
  currentGame,
  mods,
  isManaging,
  gameHealth,
  t,
  handleManageGame,
  handleUnmanageGame,
  handleDisableAll,
  handleEnableAll,
  handleInstallMod,
  setDetailMod,
  handleCheckUpdate,
  handleToggleMod,
  handleDeleteMod,
  showSourcesMenu,
  setShowSourcesMenu,
  readOnly = false,
  addToast
}) => {
  const [isLaunching, setIsLaunching] = useState(false)

  const handlePlayClick = (e: React.MouseEvent) => {
    if (isLaunching) {
      e.preventDefault()
      return
    }
    setIsLaunching(true)
    if (currentGame.platform === 'epic' && currentGame.epicAppId) {
      addToast('Launching game on Epic...', 'info')
      const url = `com.epicgames.launcher://apps/${currentGame.epicAppId}?action=launch&silent=true`
      ;(window as any).electron.openUrl(url)
    } else {
      addToast('Launching game on Steam...', 'info')
      // Steam launch is handled by the href
    }
    setTimeout(() => setIsLaunching(false), 5000)
  }

  return (
    <div
      key={currentGame.id}
      className="flex-1 flex flex-col h-full overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500 god-transition"
    >
      {/* Header / Hero */}
      <header className="relative z-10 px-8 py-8 border-b border-white/5 backdrop-blur-md">
        <div className="flex justify-between items-start">
          <div>
            <div className="flex items-center space-x-3 mb-2">
              <span
                className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider ${
                  currentGame.detected
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                }`}
              >
                {currentGame.detected ? t.ready : t.missing}
              </span>
              <span className="text-gray-500 text-xs font-mono hidden 2xl:block">
                {currentGame.path}
              </span>
            </div>
            <h2 className="text-4xl font-bold text-white tracking-tight">{currentGame.name}</h2>
          </div>

          <div className="flex items-center space-x-3">
            {(currentGame.steamAppId || currentGame.epicAppId) && (
              <a
                href={currentGame.platform === 'steam' ? `steam://run/${currentGame.steamAppId}` : '#'}
                draggable={false}
                onClick={handlePlayClick}
                className={`group px-4 py-2 bg-[rgb(var(--theme-accent))] hover:bg-[rgb(var(--theme-accent))]/80 text-white rounded-xl shadow-lg shadow-[rgb(var(--theme-accent))]/20 god-transition god-hover flex items-center space-x-2 no-underline active:scale-95 active:grayscale active:brightness-75 transition-all ${isLaunching ? 'opacity-50 grayscale cursor-wait pointer-events-none' : ''}`}
              >
                <Gamepad2 className="w-5 h-5 fill-current drop-shadow-md" />
                <span className="font-semibold drop-shadow-md">
                  {currentGame.platform === 'epic' ? t.playEpic : t.playSteam}
                </span>
              </a>
            )}

            {currentGame.managed && (
              <button
                onClick={handleInstallMod}
                className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl shadow-lg border border-white/5 font-semibold god-transition god-hover flex items-center space-x-2"
              >
                <Download className="w-5 h-5" />
                <span>{t.installMod}</span>
              </button>
            )}
            {currentGame.managed && (
              <button
                onClick={() => (window as any).electron.openUrl(currentGame.path)}
                className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-xl shadow-lg border border-white/5 font-semibold god-transition god-hover flex items-center space-x-2"
                title="Open Game Folder"
              >
                <FolderOpen className="w-5 h-5" />
                <span>{t.browseFolder}</span>
              </button>
            )}
          </div>
        </div>

        {currentGame.managed && (
          <div className="mt-8 flex items-center justify-between">
            <div className="flex space-x-6 text-sm font-medium text-[rgb(var(--theme-text-muted))]">
              <div className="flex items-center space-x-2">
                <span className="text-white text-lg">{mods.length}</span>
                <span>{t.total}</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-[rgb(var(--theme-accent))] text-lg">
                  {mods.filter((m) => m.enabled).length}
                </span>
                <span>{t.active}</span>
              </div>
            </div>

            <div className="flex space-x-3">
              {mods.length > 0 && (
                <button
                  onClick={mods.every((m) => !m.enabled) ? handleEnableAll : handleDisableAll}
                  className={`px-3 py-1.5 text-xs font-medium rounded transition-all border ${
                    mods.every((m) => !m.enabled)
                      ? 'text-emerald-300 hover:text-white bg-emerald-900/20 hover:bg-emerald-600 border-emerald-800 hover:border-emerald-500'
                      : 'text-rose-300 hover:text-white bg-rose-900/20 hover:bg-rose-600 border-rose-800 hover:border-rose-500'
                  }`}
                >
                  {mods.every((m) => !m.enabled) ? 'Enable All' : t.disableAll}
                </button>
              )}
              <button
                onClick={handleUnmanageGame}
                className="px-3 py-1.5 text-xs font-medium text-rose-300 hover:text-white bg-rose-900/10 hover:bg-rose-900/80 border border-rose-900/30 hover:border-rose-700/50 rounded transition-all"
                title="Stop managing this game and remove all mod data"
              >
                {t.unmanage}
              </button>
            </div>
          </div>
        )}
      </header>

      <div className="flex-1 p-6 overflow-y-auto">
        {!currentGame.managed ? (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-6">
            <div className="p-4 bg-white/5 rounded-full border border-white/5">
              <Box className="w-12 h-12 text-[rgb(var(--theme-text-muted))]" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white mb-2">{t.initializationRequired}</h3>
              <p className="text-[rgb(var(--theme-text-muted))] max-w-sm mx-auto">{t.initDesc}</p>
            </div>
            <button
              onClick={handleManageGame}
              disabled={isManaging}
              className={`px-8 py-3 bg-[rgb(var(--theme-accent))] hover:bg-[rgb(var(--theme-accent))]/80 text-white rounded-xl shadow-lg shadow-[rgb(var(--theme-accent))]/20 font-bold text-lg transition-all transform hover:-translate-y-1 ${
                isManaging ? 'cursor-not-allowed opacity-80' : ''
              }`}
            >
              {isManaging ? (
                <div className="flex items-center space-x-2">
                  <Loader2 className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" />
                  {t.settingUp}
                </div>
              ) : (
                t.manageGame
              )}
            </button>
          </div>
        ) : (
          <ModList
            mods={mods}
            t={t}
            gameHealth={gameHealth}
            currentGame={currentGame}
            setDetailMod={setDetailMod}
            handleCheckUpdate={handleCheckUpdate}
            handleToggleMod={handleToggleMod}
            handleDeleteMod={handleDeleteMod}
            showSourcesMenu={showSourcesMenu}
            setShowSourcesMenu={setShowSourcesMenu}
            readOnly={readOnly}
          />
        )}
      </div>
    </div>
  )
}
