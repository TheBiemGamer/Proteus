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
  RefreshCw,
  Wrench,
  ChevronLeft,
  ChevronRight
} from 'lucide-react'
import { ToastContainer, toast } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'
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
  iconUrl?: string
  toolButtons?: Array<{ label: string; action: string }>
  modSources?: Array<{ text: string; url: string }>
  theme?: {
    accent: string
    bgStart: string
    bgEnd?: string
  }
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
  note?: string
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
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)

  // Proteus Theme Logic
  useEffect(() => {
    if (!selectedGame) return

    let accent = '59, 130, 246' // Default Blue
    let bgStart = '17, 24, 39'
    let bgEnd = '3, 7, 18'

    const game = games.find((g) => g.id === selectedGame)
    if (game && game.theme) {
      accent = game.theme.accent
      bgStart = game.theme.bgStart
      if (game.theme.bgEnd) bgEnd = game.theme.bgEnd
    }

    const root = document.documentElement
    root.style.setProperty('--theme-accent', accent)
    root.style.setProperty('--theme-bg-start', bgStart)
    // Keep end dark for depth
    root.style.setProperty('--theme-bg-end', bgEnd)
  }, [selectedGame, games])

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

  const handleUpdateCheck = async () => {
    console.log('User requested update check')
    const promise = (window as any).electron.checkForUpdates()

    toast.promise(
      promise,
      {
        pending: 'Checking for updates...',
        success: {
          render({ data }: any) {
            // data is the result from checkForUpdates (UpdateCheckResult | null)
            if (!data) return 'Update check completed (Dev Mode)'
            if (data.updateInfo) return `Update available: ${data.updateInfo.version}`
            return 'No updates available'
          }
        },
        error: 'Error checking for updates'
      },
      {
        theme: 'dark'
      }
    )
  }

  useEffect(() => {
    // Only listen for downloaded event, as checking/available are handled by promise
    const d3 = (window as any).electron.onUpdateDownloaded(() => {
      addToast('Update downloaded. Restart to install?', 'success')
    })

    return () => {
      d3 && d3()
    }
  }, [])

  const loadSettings = async () => {
    const s = await (window as any).electron.getSettings()
    setSettings(s)
  }

  const addToast = (message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info') => {
    toast(message, { type: type as any, theme: 'dark' })
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
        nexusId: installPreview.meta.nexusId,
        autoEnable: true
      }

      await (window as any).electron.installModDirect(currentGame.id, installPreview.file, options)
      addToast(t.modInstalled, 'success')
      setInstallPreview(null)
      loadMods(currentGame.id)
      refreshGames() // Refresh game details (e.g. tool buttons)
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
      refreshGames()
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
      refreshGames()
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

      await refreshGames()

      if (games.find((g) => g.id === gameId)) {
        setSelectedGame(gameId)
        // Force refresh logic if needed, but useEffect handles it
        // Actually useEffect depends on selectedGame change.
        // If already selected, reload mods.
        if (selectedGame === gameId) loadMods(gameId)
      } else {
        // Game not in list? Refresh games first?
        // await refreshGames() // Already called above
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
        addToast(
          `${t.updateAvailable || 'Update available'}: ${/^\d/.test(result.latestVersion) ? 'v' : ''}${result.latestVersion}`,
          'success'
        )
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
    refreshGames()
    addToast(!mod.enabled ? t.modEnabled : t.modDisabled, 'info')
  }

  const handleDeleteMod = async (mod: Mod) => {
    if (!selectedGame) return
    if (confirm(t.confirmDeleteMod.replace('{modname}', mod.name))) {
      await (window as any).electron.deleteMod(selectedGame, mod.id)
      loadMods(selectedGame)
      refreshGames()
      addToast(t.modDeleted, 'success')
    }
  }

  const handleDisableAll = async () => {
    if (!selectedGame) return
    if (confirm(t.confirmDisableAll)) {
      await (window as any).electron.disableAllMods(selectedGame)
      loadMods(selectedGame)
      refreshGames()
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
      className="flex h-screen overflow-hidden font-sans select-none p-4 gap-4 transition-colors duration-700 ease-in-out"
      style={{
        background:
          'radial-gradient(circle at top right, rgb(var(--theme-bg-start)), rgb(var(--theme-bg-end)))'
      }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {dragOver && (
        <div className="absolute inset-4 z-50 rounded-2xl glass-panel bg-[rgb(var(--theme-accent))]/10 border-2 border-[rgb(var(--theme-accent))]/50 flex items-center justify-center animate-in fade-in duration-200 pointer-events-none">
          <div className="glass-panel p-8 rounded-2xl border border-[rgb(var(--theme-accent))]/30 flex flex-col items-center">
            <svg
              className="w-16 h-16 text-[rgb(var(--theme-accent))] mb-4 animate-bounce"
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
            <p className="text-gray-300 mt-2">Release to install archives</p>
          </div>
        </div>
      )}
      <ToastContainer
        position="bottom-right"
        autoClose={3000}
        hideProgressBar={false}
        newestOnTop
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="dark"
        toastClassName="glass-toast"
      />
      {/* Floating Dock */}
      <aside
        className={`${isSidebarCollapsed ? 'w-20' : 'w-20 lg:w-72'} glass-dock rounded-2xl flex flex-col god-transition z-10`}
      >
        <div
          className={`p-6 flex items-center ${isSidebarCollapsed ? 'justify-center' : 'justify-between'}`}
        >
          <div className={`${isSidebarCollapsed ? 'hidden' : 'hidden lg:block'}`}>
            <h1
              className="text-2xl font-black bg-gradient-to-r from-[rgb(var(--theme-accent))] to-white bg-clip-text text-transparent tracking-tighter cursor-pointer god-transition hover:opacity-80"
              onClick={() => setView('library')}
            >
              PROTEUS
            </h1>
            <p className="text-xs text-[rgb(var(--theme-text-muted))] mt-1 uppercase tracking-widest font-semibold">
              {t.library}
            </p>
          </div>

          <button
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            className={`rounded-xl hover:bg-white/5 text-[rgb(var(--theme-text-muted))] hover:text-white transition-colors outline-none ${isSidebarCollapsed ? 'p-1' : 'p-2'}`}
            title={isSidebarCollapsed ? 'Expand' : 'Collapse'}
          >
            {isSidebarCollapsed ? (
              <ChevronRight className="w-6 h-6 text-[rgb(var(--theme-accent))]" />
            ) : (
              <ChevronLeft className="w-5 h-5" />
            )}
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 space-y-2 no-scrollbar">
          {games.map((g) => (
            <button
              key={g.id}
              onClick={() => {
                setSelectedGame(g.id)
                setView('library')
              }}
              className={`group w-full flex items-center p-3 rounded-xl text-left god-transition outline-none god-hover
                ${
                  selectedGame === g.id && view === 'library'
                    ? 'bg-[rgb(var(--theme-accent))] text-white shadow-lg shadow-[rgb(var(--theme-accent))]/20'
                    : 'text-[rgb(var(--theme-text-muted))] hover:bg-white/5 hover:text-white'
                }`}
            >
              <div
                className={`flex items-center gap-3 w-full ${isSidebarCollapsed ? 'justify-center' : ''}`}
              >
                <div className="relative shrink-0">
                  {g.iconUrl ? (
                    <img
                      src={g.iconUrl}
                      className="w-10 h-10 rounded-lg object-cover bg-black/20 god-transition group-hover:scale-105"
                    />
                  ) : (
                    <div
                      className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm shadow-inner god-transition ${
                        selectedGame === g.id ? 'bg-white/20' : 'bg-white/5 group-hover:bg-white/10'
                      }`}
                    >
                      {g.name.substring(0, 1)}
                    </div>
                  )}
                  <div
                    className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-gray-900 ${
                      g.detected ? 'bg-emerald-500' : 'bg-rose-500'
                    }`}
                  />
                </div>
                <span
                  className={`${isSidebarCollapsed ? 'hidden' : 'hidden lg:block'} font-medium truncate flex-1`}
                >
                  {g.name}
                </span>
              </div>
            </button>
          ))}
        </nav>

        <div className={`space-y-2 ${isSidebarCollapsed ? 'p-2' : 'p-4'}`}>
          {currentGame && currentGame.managed && view === 'library' && (
            <div className="lg:block mb-4 space-y-2">
              <div className="h-px bg-white/10 my-4 mx-2" />
              {currentGame.toolButtons &&
                currentGame.toolButtons.map((btn, idx) => (
                  <button
                    key={idx}
                    onClick={async () => {
                      await (window as any).electron.runExtensionCommand(currentGame.id, btn.action)
                    }}
                    title={btn.label}
                    className={`bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/20 hover:border-orange-500/40 rounded-xl text-orange-200 god-transition god-hover flex items-center group ${isSidebarCollapsed ? 'w-10 h-10 mx-auto justify-center p-0' : 'w-full p-3 space-x-3 lg:justify-start'}`}
                  >
                    <Wrench className="w-5 h-5 shrink-0" />
                    <span
                      className={`${isSidebarCollapsed ? 'hidden' : 'hidden lg:block'} text-sm font-medium`}
                    >
                      {btn.label}
                    </span>
                  </button>
                ))}

              <div className="grid grid-cols-1 gap-2">
                <button
                  onClick={() => setShowExportModal(true)}
                  title={t.exportModpack}
                  className={`bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/20 hover:border-purple-500/40 rounded-xl text-purple-200 god-transition god-hover flex items-center ${isSidebarCollapsed ? 'w-10 h-10 mx-auto justify-center p-0' : 'w-full p-3 space-x-3 lg:justify-start'}`}
                >
                  <Archive className="w-5 h-5 shrink-0" />
                  <span
                    className={`${isSidebarCollapsed ? 'hidden' : 'hidden lg:block'} text-sm font-medium`}
                  >
                    {t.exportModpack}
                  </span>
                </button>
                <button
                  onClick={handlePickModpack}
                  title={t.importModpack}
                  className={`bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 hover:border-indigo-500/40 rounded-xl text-indigo-200 god-transition god-hover flex items-center ${isSidebarCollapsed ? 'w-10 h-10 mx-auto justify-center p-0' : 'w-full p-3 space-x-3 lg:justify-start'}`}
                >
                  <PackageOpen className="w-5 h-5 shrink-0" />
                  <span
                    className={`${isSidebarCollapsed ? 'hidden' : 'hidden lg:block'} text-sm font-medium`}
                  >
                    {t.importModpack}
                  </span>
                </button>
              </div>
            </div>
          )}

          <div className="h-px bg-white/10 my-2 mx-2" />

          <button
            onClick={() => setView('settings')}
            title={t.settings}
            className={`rounded-xl god-transition god-hover outline-none flex items-center justify-center ${
              view === 'settings'
                ? 'bg-[rgb(var(--theme-accent))] text-white shadow-lg shadow-[rgb(var(--theme-accent))]/20'
                : 'text-[rgb(var(--theme-text-muted))] hover:bg-white/5 hover:text-white'
            } ${isSidebarCollapsed ? 'w-10 h-10 mx-auto p-0' : 'w-full p-3'}`}
          >
            <Settings className="w-5 h-5 shrink-0" />
            <span
              className={`${isSidebarCollapsed ? 'hidden' : 'hidden lg:block'} text-sm font-medium ml-3`}
            >
              {t.settings}
            </span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 glass-panel rounded-2xl overflow-hidden flex flex-col relative z-0 god-transition">
        {view === 'settings' ? (
          <div className="flex-1 p-8 overflow-y-auto">
            <h2 className="text-3xl font-bold text-white mb-8">{t.settings}</h2>

            <div className="flex space-x-6 border-b border-white/10 mb-8">
              <button
                onClick={() => setSettingsTab('general')}
                className={`pb-4 px-2 font-medium god-transition relative ${
                  settingsTab === 'general'
                    ? 'text-[rgb(var(--theme-accent))]'
                    : 'text-[rgb(var(--theme-text-muted))] hover:text-white'
                }`}
              >
                {t.general}
                {settingsTab === 'general' && (
                  <div className="absolute bottom-0 left-0 w-full h-0.5 bg-[rgb(var(--theme-accent))] rounded-t-full shadow-[0_0_10px_rgb(var(--theme-accent))] god-transition animate-in fade-in duration-300" />
                )}
              </button>
              <button
                onClick={() => setSettingsTab('extensions')}
                className={`pb-4 px-2 font-medium god-transition relative ${
                  settingsTab === 'extensions'
                    ? 'text-[rgb(var(--theme-accent))]'
                    : 'text-[rgb(var(--theme-text-muted))] hover:text-white'
                }`}
              >
                {t.extensions}
                {settingsTab === 'extensions' && (
                  <div className="absolute bottom-0 left-0 w-full h-0.5 bg-[rgb(var(--theme-accent))] rounded-t-full shadow-[0_0_10px_rgb(var(--theme-accent))] god-transition animate-in fade-in duration-300" />
                )}
              </button>
              <button
                onClick={() => setSettingsTab('about')}
                className={`pb-4 px-2 font-medium god-transition relative ${
                  settingsTab === 'about'
                    ? 'text-[rgb(var(--theme-accent))]'
                    : 'text-[rgb(var(--theme-text-muted))] hover:text-white'
                }`}
              >
                About
                {settingsTab === 'about' && (
                  <div className="absolute bottom-0 left-0 w-full h-0.5 bg-[rgb(var(--theme-accent))] rounded-t-full shadow-[0_0_10px_rgb(var(--theme-accent))] god-transition animate-in fade-in duration-300" />
                )}
              </button>
            </div>

            {settingsTab === 'general' && (
              <div className="max-w-2xl space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500 god-transition">
                {/* General Section */}
                <div className="space-y-4">
                  <h3 className="text-xl font-semibold text-gray-300 border-b border-white/10 pb-2">
                    {t.general}
                  </h3>

                  <div className="flex flex-col space-y-2">
                    <label className="text-sm font-medium text-gray-400">{t.language}</label>
                    <select
                      value={settings.language}
                      onChange={(e) =>
                        handleSaveSettings({ ...settings, language: e.target.value as any })
                      }
                      className="glass-input rounded-xl p-2.5 text-white"
                    >
                      <option value="en" className="bg-gray-900">
                        English
                      </option>
                      <option value="nl" className="bg-gray-900">
                        Nederlands
                      </option>
                    </select>
                  </div>

                  <div className="flex items-center justify-between p-4 glass-panel rounded-xl border border-white/5 god-transition hover:border-white/10">
                    <div>
                      <h4 className="font-medium text-white">{t.developerMode}</h4>
                      <p className="text-sm text-gray-500">{t.developerModeDesc}</p>
                    </div>
                    <button
                      onClick={() =>
                        handleSaveSettings({ ...settings, developerMode: !settings.developerMode })
                      }
                      className={`w-12 h-6 rounded-full p-1 god-transition ${settings.developerMode ? 'bg-[rgb(var(--theme-accent))]' : 'bg-white/10'}`}
                    >
                      <div
                        className={`w-4 h-4 bg-white rounded-full god-transition ${settings.developerMode ? 'translate-x-6' : 'translate-x-0'}`}
                      />
                    </button>
                  </div>
                </div>

                {/* Integrations Section */}
                <div className="space-y-4">
                  <h3 className="text-xl font-semibold text-gray-300 border-b border-white/10 pb-2">
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
                      className="glass-input rounded-xl p-2.5 text-white"
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
              <div className="max-w-2xl space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500 god-transition">
                <div className="glass-panel border border-white/10 rounded-2xl p-8 text-center space-y-4">
                  <h3 className="text-3xl font-black bg-gradient-to-r from-[rgb(var(--theme-accent))] to-purple-500 bg-clip-text text-transparent">
                    Proteus Mod Manager
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
                  <div className="pt-6">
                    <button
                      onClick={handleUpdateCheck}
                      className="px-6 py-2 bg-white/5 hover:bg-white/10 text-white rounded-xl font-medium god-transition border border-white/5 hover:border-white/10"
                    >
                      Check for Updates
                    </button>
                  </div>
                </div>

                <div className="glass-panel border border-white/10 rounded-2xl p-6">
                  <h4 className="font-semibold text-white mb-4">License</h4>
                  <div className="bg-black/20 rounded-xl p-4 border border-white/5 custom-scrollbar">
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
                  <h2 className="text-4xl font-bold text-white tracking-tight">
                    {currentGame.name}
                  </h2>
                </div>

                <div className="flex items-center space-x-3">
                  {currentGame.steamAppId && (
                    <a
                      href={`steam://run/${currentGame.steamAppId}`}
                      className="group px-4 py-2 bg-[rgb(var(--theme-accent))] hover:bg-[rgb(var(--theme-accent))]/80 text-white rounded-xl shadow-lg shadow-[rgb(var(--theme-accent))]/20 god-transition god-hover flex items-center space-x-2 no-underline"
                    >
                      <Gamepad2 className="w-5 h-5 fill-current" />
                      <span className="font-semibold">{t.playSteam}</span>
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

            <div className="flex-1 p-6 overflow-y-auto custom-scrollbar">
              {!currentGame.managed ? (
                <div className="flex flex-col items-center justify-center h-full text-center space-y-6">
                  <div className="p-4 bg-white/5 rounded-full border border-white/5">
                    <Box className="w-12 h-12 text-[rgb(var(--theme-text-muted))]" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white mb-2">
                      {t.initializationRequired}
                    </h3>
                    <p className="text-[rgb(var(--theme-text-muted))] max-w-sm mx-auto">
                      {t.initDesc}
                    </p>
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
                    <div className="border-2 border-dashed border-white/5 rounded-2xl flex flex-col items-center justify-center h-64 text-[rgb(var(--theme-text-muted))]">
                      <p className="font-medium text-white">{t.noMods}</p>
                      <p className="text-sm mt-1 text-[rgb(var(--theme-text-muted))]">
                        {t.dragDrop}
                      </p>
                    </div>
                  ) : (
                    mods.map((mod) => (
                      <div
                        key={mod.id}
                        className="group glass-panel bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/10 p-4 rounded-xl god-transition hover:scale-[1.01] flex items-center justify-between mb-4 shadow-lg hover:shadow-xl"
                      >
                        <div className="flex items-center space-x-5">
                          {/* Status Indicator */}
                          <div
                            className={`w-1 h-12 rounded-full god-transition ${mod.enabled ? 'bg-[rgb(var(--theme-accent))] shadow-[0_0_15px_rgb(var(--theme-accent))]' : 'bg-white/10'}`}
                          ></div>

                          <div className="flex flex-col flex-1 pl-4">
                            <div className="flex items-center space-x-2">
                              <h3
                                className={`font-bold text-lg ${mod.enabled ? 'text-white' : 'text-[rgb(var(--theme-text-muted))]'} cursor-pointer hover:text-[rgb(var(--theme-accent))] transition-colors`}
                                onClick={() => setDetailMod(mod as any)}
                              >
                                {mod.name}
                              </h3>
                              {mod.version && (
                                <span className="text-[10px] font-mono bg-white/10 text-[rgb(var(--theme-text-muted))] px-1.5 py-0.5 rounded border border-white/5">
                                  {/^\d/.test(mod.version) ? 'v' : ''}
                                  {mod.version}
                                </span>
                              )}
                              {mod.sourceUrl && !mod.sourceUrl.includes('nexusmods.com') && (
                                <>
                                  <button
                                    onClick={() => (window as any).electron.openUrl(mod.sourceUrl)}
                                    className="text-[rgb(var(--theme-text-muted))] hover:text-[rgb(var(--theme-accent))] transition-colors"
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
                                        currentGame?.modSources?.find((s) =>
                                          s.url.includes('nexusmods.com')
                                        )?.url || 'https://www.nexusmods.com/games'
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
                        className="w-full py-4 bg-[#da8e35]/10 hover:bg-[#da8e35]/20 border border-[#da8e35]/30 hover:border-[#da8e35]/50 border-dashed rounded-xl flex items-center justify-center space-x-3 text-[#da8e35] hover:text-[#ffaa46] god-transition group"
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
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-[rgb(var(--theme-text-muted))] animate-in fade-in zoom-in-95 duration-500 god-transition">
            <div className="mb-6 p-8 glass-panel rounded-full shadow-2xl bg-[rgb(var(--theme-accent))]/5 border border-[rgb(var(--theme-accent))]/20 god-transition hover:scale-110 hover:shadow-[0_0_30px_rgb(var(--theme-accent))]/20">
              <Gamepad2 className="w-20 h-20 text-[rgb(var(--theme-accent))]" />
            </div>
            <p className="text-2xl font-bold mb-2 text-white">Select a Game</p>
            <p className="text-base text-[rgb(var(--theme-text-muted))]">
              Choose a game from the dock to manage mods
            </p>
          </div>
        )}
      </main>

      {showExportModal && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 god-transition animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowExportModal(false)
          }}
        >
          <div className="glass-panel border border-white/10 rounded-2xl p-6 w-full max-w-lg shadow-2xl god-transition animate-in zoom-in-95 duration-300">
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
                  className="w-full glass-input rounded-xl px-4 py-2 text-white"
                  placeholder="My Awesome Modpack"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">{t.author}</label>
                <input
                  type="text"
                  value={modpackMeta.author}
                  onChange={(e) => setModpackMeta({ ...modpackMeta, author: e.target.value })}
                  className="w-full glass-input rounded-xl px-4 py-2 text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">{t.version}</label>
                <input
                  type="text"
                  value={modpackMeta.version}
                  onChange={(e) => setModpackMeta({ ...modpackMeta, version: e.target.value })}
                  className="w-full glass-input rounded-xl px-4 py-2 text-white"
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
                  className="w-full glass-input rounded-xl px-4 py-2 text-white h-24"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">{t.iconPath}</label>
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={modpackMeta.imagePath}
                    onChange={(e) => setModpackMeta({ ...modpackMeta, imagePath: e.target.value })}
                    className="flex-1 glass-input rounded-xl px-4 py-2 text-gray-400"
                    placeholder="C:\Path\To\Image.png"
                  />
                </div>
              </div>
            </div>
            <div className="flex justify-end space-x-3 mt-8">
              <button
                onClick={() => setShowExportModal(false)}
                className="px-4 py-2 text-gray-400 hover:text-white god-transition"
              >
                {t.cancel}
              </button>
              <button
                onClick={handleExportModpack}
                className="px-6 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl shadow-lg shadow-purple-900/20 font-semibold god-transition"
              >
                {t.export}
              </button>
            </div>
          </div>
        </div>
      )}

      {previewModpack && (
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
      )}

      {installPreview && (
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
                    Metadata and cover image could not be fetched. Add your API key in Settings for
                    full details.
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
      )}

      {detailMod && (
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
                        currentGame?.modSources?.find((s) => s.url.includes('nexusmods.com'))
                          ?.url || 'https://www.nexusmods.com/games'
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
      )}
    </div>
  )
}

export default App
