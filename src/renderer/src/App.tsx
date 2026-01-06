import { useState, useEffect } from 'react'
import {
  FolderOpen,
  Download,
  Trash2,
  ExternalLink,
  AlertTriangle,
  Loader2,
  ChevronDown,
  PackageOpen,
  Archive,
  Gamepad2,
  Box,
  Settings
} from 'lucide-react'
import './assets/main.css'
import { translations } from './utils/i18n'
import { ExtensionManager } from './components/ExtensionManager'
import { IAppSettings } from '../../shared/types'

interface Game {
  id: string
  name: string
  detected: boolean
  managed: boolean
  path: string
  steamAppId?: string
  modSources?: Array<{ text: string; url: string }>
}

interface Mod {
  id: string
  name: string
  enabled: boolean
  type: string
  version?: string
  nexusId?: string
}

const getTypeColor = (type: string) => {
  const t = type.toLowerCase()
  if (t.includes('hotfix')) return 'bg-orange-500/10 text-orange-300 border border-orange-500/20'
  if (t.includes('sdk')) return 'bg-yellow-500/10 text-yellow-300 border border-yellow-500/20'
  if (t.includes('pak')) return 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
  if (t === 'loader' || t === 'binaries')
    return 'bg-purple-500/10 text-purple-300 border border-purple-500/20'
  return 'bg-blue-500/10 text-blue-300 border border-blue-500/20'
}

function App() {
  const [games, setGames] = useState<Game[]>([])
  const [selectedGame, setSelectedGame] = useState<string | null>(null)
  const [mods, setMods] = useState<Mod[]>([])
  const [isManaging, setIsManaging] = useState(false)
  const [gameHealth, setGameHealth] = useState<any>({ valid: true })
  const [showSourcesMenu, setShowSourcesMenu] = useState(false)

  // Settings
  const [view, setView] = useState<'library' | 'settings'>('library')
  const [settings, setSettings] = useState<IAppSettings>({
    language: 'en',
    developerMode: false,
    startMaximized: false,
    nexusApiKey: ''
  })
  const [settingsTab, setSettingsTab] = useState<'general' | 'extensions'>('general')

  // Short helper for translation
  const t = translations[settings.language] || translations.en

  // Modpack States
  const [showExportModal, setShowExportModal] = useState(false)
  const [modpackMeta, setModpackMeta] = useState({
    title: '',
    author: '',
    version: '1.0.0',
    description: '',
    imagePath: ''
  })
  const [previewModpack, setPreviewModpack] = useState<any>(null)

  useEffect(() => {
    refreshGames()
    loadSettings()
  }, [])

  const loadSettings = async () => {
    const s = await (window as any).electron.getSettings()
    setSettings(s)
  }

  const handleSaveSettings = async (newSettings: IAppSettings) => {
    setSettings(newSettings)
    await (window as any).electron.saveSettings(newSettings)
  }

  useEffect(() => {
    if (selectedGame) {
      loadMods(selectedGame)
      checkHealth(selectedGame)
    }
  }, [selectedGame])

  const checkHealth = async (gameId: string) => {
    const health = await (window as any).electron.validateGame(gameId)
    setGameHealth(health)
  }

  const refreshGames = async () => {
    const list = await (window as any).electron.getExtensions()
    setGames(list)
    if (list.length > 0 && !selectedGame) {
      setSelectedGame(list[0].id)
    }
  }

  const loadMods = async (gameId: string) => {
    const game = games.find((g) => g.id === gameId)
    if (game && game.managed) {
      const list = await (window as any).electron.getMods(gameId)
      setMods(list)
      checkHealth(gameId)
    } else {
      setMods([])
    }
  }

  const handleExportModpack = async () => {
    if (!selectedGame) return
    setIsManaging(true)
    const success = await (window as any).electron.createModpack(selectedGame, modpackMeta)
    setIsManaging(false)
    if (success) setShowExportModal(false)
  }

  const handlePickModpack = async () => {
    try {
      const info = await (window as any).electron.pickModpack()
      if (info) {
        setPreviewModpack(info)
      }
    } catch (e: any) {
      console.error(e)
    }
  }

  const handleInstallModpackConfirm = async () => {
    if (!previewModpack) return
    setIsManaging(true)
    try {
      const gameId = await (window as any).electron.installModpack(previewModpack.filePath)

      if (games.find((g) => g.id === gameId)) {
        setSelectedGame(gameId)
        // Force refresh logic if needed, but useEffect handles it
        // Actually useEffect depends on selectedGame change.
        // If already selected, reload mods.
        if (selectedGame === gameId) loadMods(gameId)
      } else {
        // Game not in list? Refresh games first?
        await refreshGames()
        setSelectedGame(gameId)
      }

      setPreviewModpack(null)
    } catch (e: any) {
      console.error(e)
      alert('Install failed: ' + e.message)
    } finally {
      setIsManaging(false)
    }
  }

  const handleManageGame = async () => {
    if (!selectedGame) return
    setIsManaging(true)
    try {
      const updatedGames = await (window as any).electron.manageGame(selectedGame)
      setGames(updatedGames)
      const game = (updatedGames as Game[]).find((g) => g.id === selectedGame)
      if (game && game.managed) {
        const list = await (window as any).electron.getMods(selectedGame)
        setMods(list)
      }
    } finally {
      setIsManaging(false)
    }
  }

  const handleInstallMod = async () => {
    if (!selectedGame) return
    const changed = await (window as any).electron.installMod(selectedGame)
    if (changed) loadMods(selectedGame)
  }

  const handleToggleMod = async (mod: Mod) => {
    if (!selectedGame) return
    await (window as any).electron.toggleMod(selectedGame, mod.id, !mod.enabled)
    loadMods(selectedGame)
  }

  const handleDeleteMod = async (mod: Mod) => {
    if (!selectedGame) return
    if (confirm(t.confirmDeleteMod.replace('{modname}', mod.name))) {
      await (window as any).electron.deleteMod(selectedGame, mod.id)
      loadMods(selectedGame)
    }
  }

  const handleDisableAll = async () => {
    if (!selectedGame) return
    if (confirm(t.confirmDisableAll)) {
      await (window as any).electron.disableAllMods(selectedGame)
      loadMods(selectedGame)
    }
  }

  const handleUnmanageGame = async () => {
    if (!selectedGame) return
    const game = games.find((g) => g.id === selectedGame)
    if (!game) return

    const confirmMsg = t.confirmUnmanage.replace('{gamename}', game.name)

    if (confirm(confirmMsg)) {
      const updatedGames = await (window as any).electron.unmanageGame(selectedGame)
      setGames(updatedGames)
      setMods([]) // Clear mods view
    }
  }

  const currentGame = games.find((g) => g.id === selectedGame)

  return (
    <div className="flex h-screen bg-gray-950 text-gray-100 font-sans selection:bg-purple-500 selection:text-white">
      {/* Sidebar */}
      <div className="w-72 bg-gray-900 border-r border-gray-800 flex flex-col shadow-2xl z-10">
        <div className="p-6">
          <h1
            className="text-2xl font-black bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent tracking-tighter cursor-pointer"
            onClick={() => setView('library')}
          >
            MOD MANAGER
          </h1>
          <p className="text-xs text-gray-500 mt-1 uppercase tracking-widest font-semibold">
            {t.library}
          </p>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 space-y-1">
          {games.map((g) => (
            <button
              key={g.id}
              onClick={() => {
                setSelectedGame(g.id)
                setView('library')
              }}
              className={`group w-full flex items-center justify-between p-3 rounded-xl text-left transition-all duration-200 outline-none focus:ring-2 focus:ring-blue-500/50 ${
                selectedGame === g.id && view === 'library'
                  ? 'bg-gradient-to-br from-gray-800 to-gray-700 text-white shadow-lg border border-gray-700'
                  : 'text-gray-400 hover:bg-gray-800/50 hover:text-gray-200'
              }`}
            >
              <div className="flex items-center space-x-3">
                {/* Game Icon Placeholder */}
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs shadow-inner ${
                    selectedGame === g.id ? 'bg-blue-600' : 'bg-gray-700 group-hover:bg-gray-600'
                  }`}
                >
                  {g.name.substring(0, 1)}
                </div>
                <span className="font-medium truncate">{g.name}</span>
              </div>

              <div
                className={`w-2 h-2 rounded-full ring-2 ring-gray-900 ${g.detected ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-rose-500'}`}
              />
            </button>
          ))}
        </nav>

        <div className="p-4 bg-gray-900/50 backdrop-blur-sm border-t border-gray-800/50 space-y-2">
          <h3 className="text-[10px] uppercase font-bold text-gray-500 tracking-wider mb-2 pl-2">
            {t.tools}
          </h3>

          {currentGame && currentGame.managed && view === 'library' && (
            <>
              <button
                onClick={() => setShowExportModal(true)}
                className="w-full py-2 bg-purple-900/20 hover:bg-purple-900/40 border border-purple-500/20 hover:border-purple-500/40 rounded-lg text-sm text-purple-200 transition-all flex items-center justify-center space-x-2"
              >
                <Archive className="w-4 h-4" />
                <span>{t.exportModpack}</span>
              </button>
              <button
                onClick={handlePickModpack}
                className="w-full py-2 bg-indigo-900/20 hover:bg-indigo-900/40 border border-indigo-500/20 hover:border-indigo-500/40 rounded-lg text-sm text-indigo-200 transition-all flex items-center justify-center space-x-2"
              >
                <PackageOpen className="w-4 h-4" />
                <span>{t.importModpack}</span>
              </button>
              <div className="h-px bg-gray-800 my-2 mx-1" />
            </>
          )}

          <button
            onClick={() => setView('settings')}
            className={`w-full py-2 rounded-lg text-sm transition-all flex items-center justify-center space-x-2 ${
              view === 'settings'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-gray-600 text-gray-300'
            }`}
          >
            <Settings className="w-4 h-4" />
            <span>{t.settings}</span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col bg-gray-950 relative overflow-hidden">
        {/* Background Gradient */}
        <div className="absolute top-0 left-0 w-full h-96 bg-gradient-to-b from-blue-900/10 to-transparent pointer-events-none" />

        {view === 'settings' ? (
          <div className="flex-1 p-8 overflow-y-auto">
            <h2 className="text-3xl font-bold text-white mb-8">{t.settings}</h2>

            <div className="flex space-x-6 border-b border-gray-800 mb-8">
              <button
                onClick={() => setSettingsTab('general')}
                className={`pb-4 px-2 font-medium transition-colors relative ${settingsTab === 'general' ? 'text-blue-400' : 'text-gray-400 hover:text-gray-300'}`}
              >
                {t.general}
                {settingsTab === 'general' && (
                  <div className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-500 rounded-t-full" />
                )}
              </button>
              <button
                onClick={() => setSettingsTab('extensions')}
                className={`pb-4 px-2 font-medium transition-colors relative ${settingsTab === 'extensions' ? 'text-blue-400' : 'text-gray-400 hover:text-gray-300'}`}
              >
                {t.extensions}
                {settingsTab === 'extensions' && (
                  <div className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-500 rounded-t-full" />
                )}
              </button>
            </div>

            {settingsTab === 'general' && (
              <div className="max-w-2xl space-y-8">
                {/* General Section */}
                <div className="space-y-4">
                  <h3 className="text-xl font-semibold text-gray-300 border-b border-gray-800 pb-2">
                    {t.general}
                  </h3>

                  <div className="flex flex-col space-y-2">
                    <label className="text-sm font-medium text-gray-400">{t.language}</label>
                    <select
                      value={settings.language}
                      onChange={(e) =>
                        handleSaveSettings({ ...settings, language: e.target.value as any })
                      }
                      className="bg-gray-800 border border-gray-700 rounded-lg p-2.5 text-white focus:ring-2 focus:ring-blue-500 outline-none"
                    >
                      <option value="en">English</option>
                      <option value="nl">Nederlands</option>
                    </select>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-gray-900 rounded-xl border border-gray-800">
                    <div>
                      <h4 className="font-medium text-white">{t.developerMode}</h4>
                      <p className="text-sm text-gray-500">{t.developerModeDesc}</p>
                    </div>
                    <button
                      onClick={() =>
                        handleSaveSettings({ ...settings, developerMode: !settings.developerMode })
                      }
                      className={`w-12 h-6 rounded-full p-1 transition-colors ${settings.developerMode ? 'bg-blue-600' : 'bg-gray-700'}`}
                    >
                      <div
                        className={`w-4 h-4 bg-white rounded-full transition-transform ${settings.developerMode ? 'translate-x-6' : 'translate-x-0'}`}
                      />
                    </button>
                  </div>
                </div>

                {/* Integrations Section */}
                <div className="space-y-4">
                  <h3 className="text-xl font-semibold text-gray-300 border-b border-gray-800 pb-2">
                    {t.integrations}
                  </h3>

                  <div className="flex flex-col space-y-2">
                    <label className="text-sm font-medium text-gray-400">{t.nexusApiKey}</label>
                    <input
                      type="password"
                      value={settings.nexusApiKey}
                      onChange={(e) =>
                        handleSaveSettings({ ...settings, nexusApiKey: e.target.value })
                      }
                      className="bg-gray-800 border border-gray-700 rounded-lg p-2.5 text-white focus:ring-2 focus:ring-blue-500 outline-none"
                      placeholder="API Key..."
                    />
                    <p className="text-xs text-gray-500">{t.nexusApiKeyDesc}</p>
                  </div>
                </div>
              </div>
            )}

            {settingsTab === 'extensions' && (
              <div className="max-w-4xl">
                <ExtensionManager t={t} onChange={refreshGames} />
              </div>
            )}
          </div>
        ) : currentGame ? (
          <>
            {/* Header / Hero */}
            <header className="relative z-10 px-8 py-8 border-b border-gray-800/50 backdrop-blur-sm">
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
                    <span className="text-gray-500 text-xs font-mono">{currentGame.path}</span>
                  </div>
                  <h2 className="text-4xl font-bold text-white tracking-tight">
                    {currentGame.name}
                  </h2>
                </div>

                <div className="flex items-center space-x-3">
                  {currentGame.steamAppId && (
                    <a
                      href={`steam://run/${currentGame.steamAppId}`}
                      className="group px-4 py-2 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white rounded-lg shadow-lg hover:shadow-emerald-500/20 transition-all flex items-center space-x-2 no-underline"
                    >
                      <Gamepad2 className="w-5 h-5 fill-current" />
                      <span className="font-semibold">{t.playSteam}</span>
                    </a>
                  )}

                  {currentGame.managed && (
                    <button
                      onClick={handleInstallMod}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg shadow-lg hover:shadow-blue-500/20 font-semibold transition-all flex items-center space-x-2"
                    >
                      <Download className="w-5 h-5" />
                      <span>{t.installMod}</span>
                    </button>
                  )}
                  {currentGame.managed && (
                    <button
                      onClick={() => (window as any).electron.openUrl(currentGame.path)}
                      className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg shadow-lg hover:shadow-gray-500/20 font-semibold transition-all flex items-center space-x-2"
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
                  <div className="flex space-x-6 text-sm font-medium text-gray-400">
                    <div className="flex items-center space-x-2">
                      <span className="text-white text-lg">{mods.length}</span>
                      <span>{t.total}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-emerald-400 text-lg">
                        {mods.filter((m) => m.enabled).length}
                      </span>
                      <span>{t.active}</span>
                    </div>
                  </div>

                  <div className="flex space-x-3">
                    {mods.filter((m) => m.enabled).length > 0 && (
                      <button
                        onClick={handleDisableAll}
                        className="px-3 py-1.5 text-xs font-medium text-rose-300 hover:text-white bg-rose-900/20 hover:bg-rose-600 border border-rose-800 hover:border-rose-500 rounded transition-all"
                      >
                        {t.disableAll}
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
                  <div className="p-4 bg-gray-900 rounded-full border border-gray-800">
                    <Box className="w-12 h-12 text-gray-600" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white mb-2">
                      {t.initializationRequired}
                    </h3>
                    <p className="text-gray-400 max-w-sm mx-auto">{t.initDesc}</p>
                  </div>
                  <button
                    onClick={handleManageGame}
                    disabled={isManaging}
                    className={`px-8 py-3 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white rounded-xl shadow-lg hover:shadow-blue-500/25 font-bold text-lg transition-all transform hover:-translate-y-1 ${
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
                <div className="space-y-3 pb-10">
                  {/* Health Warning Banner */}
                  {!gameHealth.valid && (
                    <div className="bg-yellow-500/10 border border-yellow-500/20 p-4 rounded-xl flex items-start space-x-4 mb-4">
                      <div className="p-2 bg-yellow-500/20 rounded-lg text-yellow-500">
                        <AlertTriangle className="w-6 h-6" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-bold text-yellow-200">{t.requirementsMissing}</h3>
                        <p className="text-sm text-yellow-200/70 mt-1">
                          {gameHealth.message ||
                            'This game requires dependencies that are not installed.'}
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
                    <div className="border-2 border-dashed border-gray-800 rounded-2xl flex flex-col items-center justify-center h-64 text-gray-500">
                      <p className="font-medium">{t.noMods}</p>
                      <p className="text-sm mt-1">{t.dragDrop}</p>
                    </div>
                  ) : (
                    mods.map((mod) => (
                      <div
                        key={mod.id}
                        className="group bg-gray-900/50 hover:bg-gray-800 border border-gray-800 hover:border-gray-700 p-4 rounded-xl transition-all flex items-center justify-between"
                      >
                        <div className="flex items-center space-x-5">
                          {/* Status Indicator */}
                          <div
                            className={`w-1.5 h-12 rounded-full transition-colors ${mod.enabled ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.3)]' : 'bg-gray-700'}`}
                          ></div>

                          <div>
                            <div className="flex items-center space-x-3">
                              <h3
                                className={`font-bold text-lg ${mod.enabled ? 'text-white' : 'text-gray-400'}`}
                              >
                                {mod.name}
                              </h3>
                              {mod.version && (
                                <span className="text-[10px] font-mono bg-gray-800 text-gray-300 px-1.5 py-0.5 rounded border border-gray-700">
                                  v{mod.version}
                                </span>
                              )}
                              {mod.nexusId && (
                                <button
                                  onClick={() => {
                                    const baseUrl =
                                      currentGame?.modSources?.find((s) =>
                                        s.url.includes('nexusmods.com')
                                      )?.url || 'https://www.nexusmods.com/games'
                                    ;(window as any).electron.openUrl(
                                      `${baseUrl}/mods/${mod.nexusId}`
                                    )
                                  }}
                                  className="text-gray-600 hover:text-blue-400 transition-colors"
                                  title="View on Nexus Mods"
                                >
                                  <ExternalLink className="w-4 h-4" />
                                </button>
                              )}
                            </div>

                            <div className="flex items-center mt-1 space-x-2">
                              <span
                                className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded ${getTypeColor(mod.type)}`}
                              >
                                {mod.type}
                              </span>
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
                            className={`relative w-14 h-7 rounded-full p-1 transition-all duration-300 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-blue-500 ${
                              mod.enabled
                                ? 'bg-blue-600 hover:bg-blue-500'
                                : 'bg-gray-700 hover:bg-gray-600'
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
                        className="w-full py-4 bg-[#da8e35]/10 hover:bg-[#da8e35]/20 border border-[#da8e35]/30 hover:border-[#da8e35]/50 border-dashed rounded-xl flex items-center justify-center space-x-3 text-[#da8e35] hover:text-[#ffaa46] transition-all group"
                      >
                        <Download className="w-5 h-5 fill-current" />
                        <span className="font-semibold">{t.getMoreMods}</span>
                        <ChevronDown
                          className={`w-4 h-4 transition-transform ${showSourcesMenu ? 'rotate-180' : 'group-hover:translate-x-1'}`}
                        />
                      </button>

                      {/* Dropdown Menu */}
                      {showSourcesMenu && (
                        <div className="absolute bottom-full left-0 w-full mb-2 bg-[#1a1c23] border border-gray-700 rounded-xl shadow-2xl overflow-hidden z-20">
                          {currentGame.modSources?.map((source, idx) => (
                            <button
                              key={idx}
                              onClick={() => (window as any).electron.openUrl(source.url)}
                              className="w-full text-left px-4 py-3 hover:bg-blue-500/10 hover:text-blue-400 text-gray-300 transition-colors flex items-center space-x-3 border-b border-gray-800 last:border-0"
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
              )}
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-gray-600 bg-gray-950/50">
            <div className="mb-4 p-6 bg-gray-900 rounded-full shadow-2xl">
              <Gamepad2 className="w-16 h-16 text-gray-700" />
            </div>
            <p className="text-xl font-medium mb-1">Select a game</p>
            <p className="text-sm">Choose a game from the sidebar to manage mods</p>
          </div>
        )}
      </div>

      {showExportModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 w-full max-w-lg shadow-2xl">
            <h3 className="text-2xl font-bold text-white mb-6">{t.exportModpack}</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">
                  {t.modpackTitle}
                </label>
                <input
                  type="text"
                  value={modpackMeta.title}
                  onChange={(e) => setModpackMeta({ ...modpackMeta, title: e.target.value })}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-purple-500"
                  placeholder="My Awesome Modpack"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">{t.author}</label>
                <input
                  type="text"
                  value={modpackMeta.author}
                  onChange={(e) => setModpackMeta({ ...modpackMeta, author: e.target.value })}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-purple-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">{t.version}</label>
                <input
                  type="text"
                  value={modpackMeta.version}
                  onChange={(e) => setModpackMeta({ ...modpackMeta, version: e.target.value })}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-purple-500"
                  placeholder="1.0.0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">
                  {t.description}
                </label>
                <textarea
                  value={modpackMeta.description}
                  onChange={(e) => setModpackMeta({ ...modpackMeta, description: e.target.value })}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-purple-500 h-24"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">{t.iconPath}</label>
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={modpackMeta.imagePath}
                    onChange={(e) => setModpackMeta({ ...modpackMeta, imagePath: e.target.value })}
                    className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-gray-400"
                    placeholder="C:\Path\To\Image.png"
                  />
                </div>
              </div>
            </div>
            <div className="flex justify-end space-x-3 mt-8">
              <button
                onClick={() => setShowExportModal(false)}
                className="px-4 py-2 text-gray-400 hover:text-white"
              >
                {t.cancel}
              </button>
              <button
                onClick={handleExportModpack}
                className="px-6 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg font-semibold"
              >
                {t.export}
              </button>
            </div>
          </div>
        </div>
      )}

      {previewModpack && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-indigo-500/30 rounded-2xl p-0 w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {previewModpack.image && (
              <div className="h-48 w-full bg-gray-800 relative">
                <img src={previewModpack.image} className="w-full h-full object-cover opacity-60" />
                <div className="absolute inset-0 bg-gradient-to-t from-gray-900 to-transparent" />
                <div className="absolute bottom-4 left-6">
                  <h2 className="text-3xl font-bold text-white shadow-sm">
                    {previewModpack.meta.title}
                  </h2>
                  <p className="text-indigo-300">
                    v{previewModpack.meta.version} by {previewModpack.meta.author}
                  </p>
                </div>
              </div>
            )}
            {!previewModpack.image && (
              <div className="p-8 border-b border-gray-800">
                <h2 className="text-3xl font-bold text-white">{previewModpack.meta.title}</h2>
                <p className="text-indigo-300">
                  v{previewModpack.meta.version} by {previewModpack.meta.author}
                </p>
              </div>
            )}

            <div className="p-6 flex-1 overflow-y-auto">
              <p className="text-gray-300 mb-6 whitespace-pre-wrap">
                {previewModpack.meta.description}
              </p>

              <h4 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">
                {t.modsIncluded} ({previewModpack.mods.length})
              </h4>
              <div className="bg-gray-950/50 rounded-lg p-2 max-h-40 overflow-y-auto border border-gray-800">
                {previewModpack.mods.map((m: any) => (
                  <div
                    key={m.id}
                    className="flex justify-between items-center p-2 text-sm border-b border-gray-800/50 last:border-0 hover:bg-white/5 rounded"
                  >
                    <span className="text-gray-300">{m.name}</span>
                    <span className="text-gray-600 font-mono text-xs">{m.version}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-6 border-t border-gray-800 flex justify-end space-x-3 bg-gray-900">
              <button
                onClick={() => setPreviewModpack(null)}
                className="px-4 py-2 text-gray-400 hover:text-white"
              >
                {t.cancel}
              </button>
              <button
                onClick={handleInstallModpackConfirm}
                className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-semibold flex items-center space-x-2"
              >
                {isManaging ? <span>{t.installing}</span> : <span>{t.installPack}</span>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
