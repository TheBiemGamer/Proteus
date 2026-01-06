import { useState, useEffect, DragEvent } from 'react'
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
  Settings,
  RefreshCw
} from 'lucide-react'
import './assets/main.css'
import { translations } from './utils/i18n'
import { ExtensionManager } from './components/ExtensionManager'
import { IAppSettings } from '../../shared/types'

import { ToastContainer, Toast } from './components/ToastContainer'

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
  sourceUrl?: string
  author?: string
  description?: string
  imageUrl?: string
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
  const [appVersion, setAppVersion] = useState<string>('')
  const [toasts, setToasts] = useState<Toast[]>([])

  // UI States
  const [dragOver, setDragOver] = useState(false)
  const [installPreview, setInstallPreview] = useState<{ file: string; meta: any } | null>(null)
  const [detailMod, setDetailMod] = useState<Mod | null>(null)

  // Settings
  const [view, setView] = useState<'library' | 'settings'>('library')
  const [settings, setSettings] = useState<IAppSettings>({
    language: 'en',
    developerMode: false,
    startMaximized: false,
    nexusApiKey: ''
  })
  const [settingsTab, setSettingsTab] = useState<'general' | 'extensions' | 'about'>('general')

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
    loadAppVersion()
  }, [])

  const loadAppVersion = async () => {
    const v = await (window as any).electron.getAppVersion()
    setAppVersion(v)
  }

  const loadSettings = async () => {
    const s = await (window as any).electron.getSettings()
    setSettings(s)
  }

  const addToast = (message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info') => {
    const id = Date.now()
    setToasts((prev) => [...prev, { id, message, type }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 3000)
  }

  const removeToast = (id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
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
    if (success) {
      setShowExportModal(false)
      addToast(t.modpackExported, 'success')
    }
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

  const handleInstallMod = async () => {
    if (!currentGame) return
    // New flow: Analyzer -> Preview -> Install
    const { canceled, filePath } = await (window as any).electron.installMod(currentGame.id)
    if (!canceled && filePath) {
      handleAnalyzeAndInstall(filePath)
    }
  }

  const handleAnalyzeAndInstall = async (filePath: string) => {
    if (!currentGame) return
    addToast('Analyzing file...', 'info')

    try {
      const result = await (window as any).electron.analyzeFile(currentGame.id, filePath)

      if (result.type === 'modpack') {
        setPreviewModpack({ ...result.meta, filePath })
      } else {
        // Mod
        setInstallPreview({ file: filePath, meta: result.meta })
      }
    } catch (e: any) {
      addToast('Failed to analyze file', 'error')
    }
  }

  const confirmModInstall = async () => {
    if (!currentGame || !installPreview) return
    setIsManaging(true)
    try {
      // Pass metadata from preview so we don't refetch
      const options = {
        author: installPreview.meta.author,
        description: installPreview.meta.description,
        imageUrl: installPreview.meta.imageUrl,
        version: installPreview.meta.version,
        nexusId: installPreview.meta.nexusId
      }

      await (window as any).electron.installModDirect(currentGame.id, installPreview.file, options)
      addToast(t.modInstalled, 'success')
      setInstallPreview(null)
      loadMods(currentGame.id)
    } catch (e) {
      console.error(e)
      addToast('Install failed', 'error')
    } finally {
      setIsManaging(false)
    }
  }

  const handleToggleDetailMod = async () => {
    if (!currentGame || !detailMod) return
    try {
      await (window as any).electron.toggleMod(currentGame.id, detailMod.id, !detailMod.enabled)
      setDetailMod((prev) => (prev ? { ...prev, enabled: !prev.enabled } : null))
      loadMods(currentGame.id)
      if (!detailMod.enabled) addToast(t.modEnabled, 'success')
      else addToast(t.modDisabled, 'info')
    } catch (e) {
      addToast('Failed to toggle', 'error')
    }
  }

  const handleUninstallDetailMod = async () => {
    if (!currentGame || !detailMod) return
    if (!confirm(t.confirmDeleteMod.replace('{modname}', detailMod.name))) return

    try {
      await (window as any).electron.deleteMod(currentGame.id, detailMod.id)
      setDetailMod(null)
      loadMods(currentGame.id)
      addToast(t.modDeleted, 'success')
    } catch (e) {
      addToast('Failed to delete', 'error')
    }
  }

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault()
    if (!dragOver) setDragOver(true)
  }

  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault()
    if (dragOver) setDragOver(false)
  }

  const handleDrop = async (e: DragEvent) => {
    e.preventDefault()
    setDragOver(false)

    if (!currentGame || !currentGame.managed) return

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0]
      // Use webUtils via preload if available, else fallback
      let path = (file as any).path
      if ((window as any).electron.getPathForFile) {
        try {
          path = (window as any).electron.getPathForFile(file)
        } catch (err) {
          console.warn('Failed to get path via webUtils', err)
        }
      }

      if (path) {
        handleAnalyzeAndInstall(path)
      }
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
      addToast(t.modpackInstalled, 'success')
    } catch (e: any) {
      console.error(e)
      alert('Install failed: ' + e.message)
      addToast(t.modpackInstallFailed, 'error')
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
        // Refresh health check immediately after managing
        await checkHealth(selectedGame)
        addToast(t.gameManaged, 'success')
      }
    } finally {
      setIsManaging(false)
    }
  }

  const handleCheckUpdate = async (mod: Mod) => {
    if (!currentGame) return
    addToast(t.checkingUpdates || 'Checking for updates...', 'info')

    try {
      const result = await (window as any).electron.checkModUpdate(currentGame.id, mod.id)

      if (result.error) {
        addToast(result.error, 'error')
      } else if (result.updateAvailable) {
        addToast(`${t.updateAvailable || 'Update available'}: v${result.latestVersion}`, 'success')
      } else if (result.supported === false) {
        // addToast(t.updateNotSupported || 'Update check not supported', 'info')
      } else {
        addToast(t.upToDate || 'Mod is up to date', 'success')
      }
    } catch (e: any) {
      addToast(e.message || 'Update check failed', 'error')
    }
  }

  const handleToggleMod = async (mod: Mod) => {
    if (!selectedGame) return
    await (window as any).electron.toggleMod(selectedGame, mod.id, !mod.enabled)
    loadMods(selectedGame)
    addToast(!mod.enabled ? t.modEnabled : t.modDisabled, 'info')
  }

  const handleDeleteMod = async (mod: Mod) => {
    if (!selectedGame) return
    if (confirm(t.confirmDeleteMod.replace('{modname}', mod.name))) {
      await (window as any).electron.deleteMod(selectedGame, mod.id)
      loadMods(selectedGame)
      addToast(t.modDeleted, 'success')
    }
  }

  const handleDisableAll = async () => {
    if (!selectedGame) return
    if (confirm(t.confirmDisableAll)) {
      await (window as any).electron.disableAllMods(selectedGame)
      loadMods(selectedGame)
      addToast(t.modsDisabled, 'warning')
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
    <div
      className="flex h-screen bg-gray-950 text-gray-100 font-sans selection:bg-purple-500 selection:text-white relative"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {dragOver && (
        <div className="absolute inset-0 z-50 bg-blue-500/20 backdrop-blur-sm border-4 border-blue-500 border-dashed m-4 rounded-xl flex items-center justify-center pointer-events-none">
          <div className="bg-gray-900 p-8 rounded-2xl shadow-2xl flex flex-col items-center animate-bounce">
            <svg
              className="w-16 h-16 text-blue-400 mb-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
            <h3 className="text-2xl font-bold text-white">Drop to Install</h3>
          </div>
        </div>
      )}
      <ToastContainer toasts={toasts} removeToast={removeToast} />
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
              <button
                onClick={() => setSettingsTab('about')}
                className={`pb-4 px-2 font-medium transition-colors relative ${settingsTab === 'about' ? 'text-blue-400' : 'text-gray-400 hover:text-gray-300'}`}
              >
                About
                {settingsTab === 'about' && (
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
                <ExtensionManager t={t} onChange={refreshGames} showToast={addToast} />
              </div>
            )}

            {settingsTab === 'about' && (
              <div className="max-w-2xl space-y-6">
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center space-y-4">
                  <h3 className="text-3xl font-black bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
                    ModManager
                  </h3>
                  <p className="text-gray-400">
                    A modular, extensible mod manager for various games, built with Electron and
                    React.
                  </p>
                  <div className="flex justify-center space-x-4 text-sm text-gray-500 pt-4">
                    <div>
                      <span className="font-semibold text-gray-400">Version</span>
                      <p>{appVersion}</p>
                    </div>
                    <div>
                      <span className="font-semibold text-gray-400">Author</span>
                      <p>TheBiemGamer</p>
                    </div>
                    <div>
                      <span className="font-semibold text-gray-400">License</span>
                      <p>MIT</p>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                  <h4 className="font-semibold text-white mb-4">License</h4>
                  <div className="bg-gray-950/50 rounded-lg p-4 border border-gray-800/50">
                    <div className="text-xs text-gray-400 font-mono space-y-2 max-h-48 overflow-y-auto pr-2">
                      <p>MIT License</p>
                      <p>Copyright (c) 2026 TheBiemGamer</p>
                      <p>
                        Permission is hereby granted, free of charge, to any person obtaining a copy
                        of this software and associated documentation files (the
                        &quot;Software&quot;), to deal in the Software without restriction,
                        including without limitation the rights to use, copy, modify, merge,
                        publish, distribute, sublicense, and/or sell copies of the Software, and to
                        permit persons to whom the Software is furnished to do so, subject to the
                        following conditions:
                      </p>
                      <p>
                        The above copyright notice and this permission notice shall be included in
                        all copies or substantial portions of the Software.
                      </p>
                      <p>
                        THE SOFTWARE IS PROVIDED &quot;AS IS&quot;, WITHOUT WARRANTY OF ANY KIND,
                        EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
                        MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO
                        EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
                        DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
                        OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
                        USE OR OTHER DEALINGS IN THE SOFTWARE.
                      </p>
                    </div>
                  </div>
                </div>
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

                          <div className="flex flex-col flex-1 pl-4">
                            <div className="flex items-center space-x-2">
                              <h3
                                className={`font-bold text-lg ${mod.enabled ? 'text-white' : 'text-gray-400'} cursor-pointer hover:text-blue-400 transition-colors`}
                                onClick={() => setDetailMod(mod as any)}
                              >
                                {mod.name}
                              </h3>
                              {mod.version && (
                                <span className="text-[10px] font-mono bg-gray-800 text-gray-300 px-1.5 py-0.5 rounded border border-gray-700">
                                  v{mod.version}
                                </span>
                              )}
                              {mod.sourceUrl && (
                                <>
                                  <button
                                    onClick={() => (window as any).electron.openUrl(mod.sourceUrl)}
                                    className="text-gray-600 hover:text-blue-400 transition-colors"
                                    title={
                                      mod.sourceUrl.includes('github.com')
                                        ? 'View on GitHub'
                                        : 'View Source'
                                    }
                                  >
                                    <ExternalLink className="w-4 h-4" />
                                  </button>
                                  {mod.sourceUrl.includes('github.com') && (
                                    <button
                                      onClick={() => handleCheckUpdate(mod)}
                                      className="text-gray-600 hover:text-green-400 transition-colors"
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
                  <div className="flex items-center space-x-2 text-indigo-300 mt-1">
                    <span className="font-semibold px-2 py-0.5 rounded bg-black/40 border border-white/10 text-xs uppercase tracking-wider text-white">
                      {games.find((g) => g.id === previewModpack.meta.gameId)?.name ||
                        previewModpack.meta.gameId}
                    </span>
                    <span>
                      v{previewModpack.meta.version} by {previewModpack.meta.author}
                    </span>
                  </div>
                </div>
              </div>
            )}
            {!previewModpack.image && (
              <div className="p-8 border-b border-gray-800">
                <h2 className="text-3xl font-bold text-white">{previewModpack.meta.title}</h2>
                <div className="flex items-center space-x-2 text-indigo-300 mt-3">
                  <span className="font-semibold px-2 py-0.5 rounded bg-indigo-900/50 border border-indigo-500/30 text-indigo-200 text-xs uppercase tracking-wider">
                    {games.find((g) => g.id === previewModpack.meta.gameId)?.name ||
                      previewModpack.meta.gameId}
                  </span>
                  <span>
                    v{previewModpack.meta.version} by {previewModpack.meta.author}
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

      {installPreview && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="relative">
              {installPreview.meta.imageUrl ? (
                <div className="h-40 w-full relative">
                  <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-gray-900/40 to-transparent z-10" />
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
                <div className="p-6 pb-2 bg-gradient-to-r from-gray-800 to-gray-900 border-b border-gray-800">
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
                    Metadata and cover image could not be fetched. Add your API key in Settings for
                    full details.
                  </div>
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <span className="px-2 py-1 bg-gray-800 rounded text-xs text-gray-400 border border-gray-700">
                  v{installPreview.meta.version || '?.?.?'}
                </span>
                <span className="px-2 py-1 bg-gray-800 rounded text-xs text-blue-400 border border-gray-700">
                  {installPreview.meta.author || 'Unknown Author'}
                </span>
                {installPreview.meta.nexusId && (
                  <span className="px-2 py-1 bg-orange-900/50 text-orange-400 rounded text-xs border border-orange-700/50">
                    NexusMods: {installPreview.meta.nexusId}
                  </span>
                )}
              </div>

              <p className="text-gray-300 whitespace-pre-wrap leading-relaxed">
                {installPreview.meta.description || 'No description available.'}
              </p>
            </div>

            <div className="p-6 border-t border-gray-800 bg-gray-950/50 flex justify-end space-x-3">
              <button
                onClick={() => setInstallPreview(null)}
                className="px-4 py-2 text-gray-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={confirmModInstall}
                disabled={isManaging}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-semibold shadow-lg shadow-blue-900/20"
              >
                {isManaging ? 'Installing...' : 'Install Mod'}
              </button>
            </div>
          </div>
        </div>
      )}

      {detailMod && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="relative">
              {detailMod.imageUrl ? (
                <div className="h-40 w-full relative group">
                  <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-gray-900/40 to-transparent z-10" />
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
                <div className="p-6 pb-2 bg-gradient-to-r from-gray-800 to-gray-900 border-b border-gray-800">
                  <h2 className="text-2xl font-bold text-white">{detailMod.name}</h2>
                </div>
              )}

              <button
                className="absolute top-4 right-4 z-30 p-2 bg-black/50 hover:bg-black/70 rounded-full text-white"
                onClick={() => setDetailMod(null)}
              >
                ✕
              </button>
            </div>

            <div className="p-6 flex-1 overflow-y-auto space-y-4">
              <div className="flex flex-wrap gap-2">
                <span className="px-2 py-1 bg-gray-800 rounded text-xs text-gray-400 border border-gray-700">
                  v{detailMod.version || '?.?.?'}
                </span>
                <span className="px-2 py-1 bg-gray-800 rounded text-xs text-blue-400 border border-gray-700">
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

            <div className="p-6 border-t border-gray-800 bg-gray-950/50 flex justify-between items-center">
              <button
                onClick={handleUninstallDetailMod}
                className="px-4 py-2 text-rose-400 hover:text-rose-300 hover:bg-rose-900/20 rounded-lg transition-colors"
              >
                Uninstall
              </button>
              <div className="flex space-x-3">
                {detailMod.nexusId && (
                  <button
                    onClick={() => {
                      const baseUrl =
                        currentGame?.modSources?.find((s) => s.url.includes('nexusmods.com'))
                          ?.url || 'https://www.nexusmods.com/games'
                      ;(window as any).electron.openUrl(`${baseUrl}/mods/${detailMod.nexusId}`)
                    }}
                    className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-lg font-medium border border-gray-700 flex items-center space-x-2"
                  >
                    <ExternalLink className="w-4 h-4" />
                    <span>Nexus Mods</span>
                  </button>
                )}
                {detailMod.sourceUrl && (
                  <button
                    onClick={() => (window as any).electron.openUrl(detailMod.sourceUrl)}
                    className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-lg font-medium border border-gray-700 flex items-center space-x-2"
                  >
                    <ExternalLink className="w-4 h-4" />
                    <span>Source</span>
                  </button>
                )}
                <button
                  onClick={handleToggleDetailMod}
                  className={`px-6 py-2 rounded-lg font-semibold shadow-lg transition-all ${detailMod.enabled ? 'bg-gray-700 hover:bg-gray-600 text-gray-200' : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-900/20'}`}
                >
                  {detailMod.enabled ? 'Disable' : 'Enable'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
