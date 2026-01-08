import { useState, useEffect, useMemo, DragEvent, ReactNode } from 'react'
import { ToastContainer, toast } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'
import './assets/main.css'
import { useSmoothTheme } from './hooks/useSmoothTheme'
import { translations } from './utils/i18n'
import { IAppSettings } from '../../shared/types'
import { Sidebar } from './components/Sidebar'
import { SettingsView } from './components/SettingsView'
import { GameLibrary } from './components/GameLibrary'
import { NoGameSelected } from './components/NoGameSelected'
import { DragDropOverlay } from './components/DragDropOverlay'
import { ExportModpackModal } from './components/modals/ExportModpackModal'
import { PreviewModpackModal } from './components/modals/PreviewModpackModal'
import { InstallPreviewModal } from './components/modals/InstallPreviewModal'
import { RedirectModal } from './components/modals/RedirectModal'
import { ModDetailModal } from './components/modals/ModDetailModal'
import { AdminPermissionModal } from './components/modals/AdminPermissionModal' // Added
import { Game, Mod } from './types'
import { TutorialWizard } from './components/TutorialWizard'

const TUTORIAL_GAME: Game = {
  id: 'dummy-subnautica',
  name: 'Subnautica',
  path: 'C:\\Games\\Subnautica',
  detected: true,
  managed: true,
  iconUrl: 'https://cdn2.steamgriddb.com/icon/03ff5913b0517be4231fee8f421f2699/32/256x256.png',
  theme: { accent: '34, 211, 238', bgStart: '12, 74, 110' },
  modSources: []
}

const TUTORIAL_MODS: Mod[] = [
  {
    id: '1108',
    name: "Tobey's BepInEx Pack for Subnautica",
    version: '5.2.0',
    author: 'Tobey',
    enabled: true,
    type: 'Loader',
    nexusId: '1108'
  },
  {
    id: '1262',
    name: 'Nautilus',
    version: '1.0.0',
    author: 'Subnautica Modding',
    enabled: true,
    type: 'API',
    nexusId: '1262'
  },
  {
    id: '12',
    name: 'Map',
    version: '1.0',
    author: 'Newman',
    enabled: false,
    type: 'Mod',
    nexusId: '12'
  }
]

function App() {
  const [games, setGames] = useState<Game[]>([])
  const [selectedGame, setSelectedGame] = useState<string | null>(null)
  const [mods, setMods] = useState<Mod[]>([])
  const [isManaging, setIsManaging] = useState(false)
  const [gameHealth, setGameHealth] = useState<any>({ valid: true })
  const [showSourcesMenu, setShowSourcesMenu] = useState(false)
  const [appVersion, setAppVersion] = useState<string>('')
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)

  // Tutorial State
  const [isTutorialActive, setIsTutorialActive] = useState(false)
  const [tutorialStep, setTutorialStep] = useState(0)
  const [tutorialMods, setTutorialMods] = useState<Mod[]>([...TUTORIAL_MODS])

  // Tutorial Mocking Effect
  useEffect(() => {
    if (isTutorialActive) {
      setGames([TUTORIAL_GAME])
      setSelectedGame(TUTORIAL_GAME.id)
      setMods(tutorialMods)
    }
  }, [isTutorialActive, tutorialMods])

   const handleTutorialApiKey = async (apiKey: string) => {
    // 1. Save locally
    const merged = { ...settings, nexusApiKey: apiKey }
    setSettings(merged)
    handleSaveSettings(merged) // actually saves to disk

    // 2. Fetch metadata for tutorial mods
    // IDs: 1108 (BepInEx), 1262 (Nautilus), 12 (Map)
    // Game: subnautica
    try {
      const fetchMod = async (mod: Mod) => {
        if (!mod.nexusId) return mod
        const meta = await (window as any).electron.fetchNexusMetadata(apiKey, 'subnautica', mod.nexusId)
        if (meta && meta.name) {
          return {
            ...mod,
            name: meta.name,
            version: meta.version || mod.version,
            author: meta.user ? meta.user.name : (meta.author || mod.author),
            description: meta.summary,
            imageUrl: meta.picture_url
          }
        }
        return mod
      }

      const updated = await Promise.all(tutorialMods.map(fetchMod))
      // Update the tutorial state, which triggers usage in the UI
      setTutorialMods(updated)
      setMods(updated) // Force immediate update
    } catch (e) {
      console.error("Tutorial fetch failed", e)
    }
  }

  // Skip mod loading if tutorial
  useEffect(() => {
    if (isTutorialActive) return
    if (selectedGame) {
      loadMods(selectedGame)
      checkHealth(selectedGame)
    }
  }, [selectedGame, isTutorialActive]) // Added isTutorialActive dep

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1024) {
        setIsSidebarCollapsed(true)
      } else {
        setIsSidebarCollapsed(false)
      }
    }

    // Initial check
    handleResize()

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Proteus Theme Logic
  const themeTargets = useMemo(() => {
    let accent = '59, 130, 246' // Default Blue
    let bgStart = '17, 24, 39'
    let bgEnd = '3, 7, 18'

    if (selectedGame) {
      const game = games.find((g) => g.id === selectedGame)
      if (game && game.theme) {
        accent = game.theme.accent
        bgStart = game.theme.bgStart
        if (game.theme.bgEnd) bgEnd = game.theme.bgEnd
      }
    }
    return { accent, bgStart, bgEnd }
  }, [selectedGame, games])

  useSmoothTheme(themeTargets.accent, themeTargets.bgStart, themeTargets.bgEnd)

  // UI States
  const [dragOver, setDragOver] = useState(false)
  const [installPreview, setInstallPreview] = useState<{ file: string; meta: any } | null>(null)
  const [redirectInfo, setRedirectInfo] = useState<{
    gameId: string
    gameName: string
    meta: any
    filePath: string
  } | null>(null)
  const [detailMod, setDetailMod] = useState<Mod | null>(null)

  // Settings
  const [view, setView] = useState<'library' | 'settings'>('library')
  const [settings, setSettings] = useState<IAppSettings>({
    language: 'en',
    deploymentMethod: 'symlink',
    developerMode: false,
    startMaximized: false,
    alwaysRunAsAdmin: false,
    suppressAdminWarning: false,
    nexusApiKey: '',
    tutorialCompleted: false
  })

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

  // Admin Modal
  const [showAdminModal, setShowAdminModal] = useState(false)

  useEffect(() => {
    // Listen for admin request
    const removeAdminListener = window.electron.onRequestAdminPermission(() => {
      // Don't show admin modal during tutorial
      if (!isTutorialActive) {
        setShowAdminModal(true)
      }
    })
    return () => {
      removeAdminListener()
    }
  }, [isTutorialActive])

  const loadAppVersion = async () => {
    const v = await (window as any).electron.getAppVersion()
    setAppVersion(v)
  }

  useEffect(() => {
    // Initial startup sequence
    const init = async () => {
      await loadAppVersion()
      
      const s = await (window as any).electron.getSettings()
      setSettings(s)

      if (!s.tutorialCompleted) {
        setIsTutorialActive(true)
        setTutorialStep(0)
        // Set Mock Game immediately
        setGames([TUTORIAL_GAME])
        setSelectedGame(TUTORIAL_GAME.id)
        setMods(TUTORIAL_MODS)
      } else {
        refreshGames()
      }
    }
    
    init()
  }, [])

  const handleUpdateCheck = async () => {
    console.log('User requested update check')
    const promise = (window as any).electron.checkForUpdates()

    toast.promise(
      promise,
      {
        pending: 'Checking for updates...',
        success: {
          render({ data }: any) {
            if (!data) return 'Update check completed'
            if (data.updateInfo && data.updateInfo.version !== appVersion) {
              return `Update available: ${data.updateInfo.version}`
            }
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
    const d3 = (window as any).electron.onUpdateDownloaded(() => {
      addToast(
        <div>
          <p>Update downloaded. Restart to install?</p>
          <button
            className="mt-2 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm"
            onClick={() => (window as any).electron.quitAndInstall()}
          >
            Restart Now
          </button>
        </div>,
        'success'
      )
    })

    return () => {
      d3 && d3()
    }
  }, [])



  const handleTutorialComplete = async (newSettings: Partial<IAppSettings>) => {
    const merged = { ...settings, ...newSettings, tutorialCompleted: true }
    setSettings(merged)
    await (window as any).electron.saveSettings(merged)
    
    // Reset state before leaving tutorial
    setIsTutorialActive(false)
    setSelectedGame(null) 
    setGames([]) 
    
    // Load real environment
    refreshGames(true)
  }

  const addToast = (
    message: string | ReactNode,
    type: 'success' | 'error' | 'info' | 'warning' = 'info'
  ) => {
    toast(message, { type: type as any, theme: 'dark' })
  }

  const handleSaveSettings = async (newSettings: IAppSettings) => {
    setSettings(newSettings)
    await (window as any).electron.saveSettings(newSettings)
  }

  const checkHealth = async (gameId: string) => {
    if (isTutorialActive) {
      setGameHealth({ valid: true })
      return
    }
    const health = await (window as any).electron.validateGame(gameId)
    setGameHealth(health)
  }

  const refreshGames = async (force = false) => {
    if (isTutorialActive && !force) return
    const list = await (window as any).electron.getExtensions()
    setGames(list)
    
    // Auto-select first game if none selected or current selection is invalid (e.g. dummy game)
    const currentIsValid = list.find(g => g.id === selectedGame)
    if (list.length > 0 && (!selectedGame || !currentIsValid)) {
      setSelectedGame(list[0].id)
    }
  }

  const loadMods = async (gameId: string) => {
    if (isTutorialActive) return
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

    const promise = (async () => {
      const result = await (window as any).electron.analyzeFile(currentGame.id, filePath)

      if (result.type === 'redirect') {
        const otherGame = games.find((g) => g.id === result.gameId)
        if (otherGame) {
          setRedirectInfo({
            gameId: result.gameId,
            gameName: otherGame.name,
            meta: result.meta,
            filePath: filePath
          })
          return 'Redirect detected'
        }
      }

      if (result.type === 'modpack') {
        setPreviewModpack({ ...result.meta, filePath })
        return `Modpack detected: ${result.meta.title}`
      } else {
        // Mod
        setInstallPreview({ file: filePath, meta: result.meta })
        return 'Analysis complete'
      }
    })()

    toast.promise(
      promise,
      {
        pending: 'Analyzing file...',
        success: {
          render({ data }) {
            return data
          }
        },
        error: 'Failed to analyze file'
      },
      { theme: 'dark' }
    )
  }

  const handleSwitchGame = () => {
    if (!redirectInfo) return
    const { gameId, filePath } = redirectInfo

    setRedirectInfo(null)
    setSelectedGame(gameId)

    // Wait for state update then re-trigger
    setTimeout(() => {
      // Manually invoke with new ID
      ;(window as any).electron.analyzeFile(gameId, filePath).then((res: any) => {
        if (res.type === 'modpack') {
          setPreviewModpack({ ...res.meta, filePath })
        } else if (res.type === 'mod') {
          setInstallPreview({ file: filePath, meta: res.meta })
        }
      })
    }, 300)
  }

  const handleInstallHere = () => {
    if (!redirectInfo) return
    const { filePath, meta } = redirectInfo

    // Force install in current game context using the metadata we found
    setInstallPreview({ file: filePath, meta: meta })
    setRedirectInfo(null)
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

    // Fix for flickering: check if we are moving to a child element of the drop zone
    if (e.relatedTarget && e.currentTarget.contains(e.relatedTarget as Node)) {
      return
    }

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
    const toastId = toast.loading('Preparing game...', { theme: 'dark' })
    const seenUrls = new Set<string>()

    const cleanup = (window as any).electron.onDownloadProgress((data: any) => {
      seenUrls.add(data.url)
      const filename = data.url.split('/').pop()?.split('?')[0] || 'file'
      // Determine if we need to reset the toast to loading or just update
      // But toast.update keeps it open. We just need to make sure we show it.
      // If render content matches, toast might not re-render if it thinks nothing changed?
      // Adding progress ensures change.
      toast.update(toastId, {
        render: `Downloading resource ${seenUrls.size}: ${filename} (${Math.round(data.progress)}%)`,
        progress: data.progress / 100,
        type: 'info', // Explicitly keep it as info/loading
        isLoading: true 
      })
    })

    try {
      const updatedGames = await (window as any).electron.manageGame(selectedGame)
      setGames(updatedGames)
      const game = (updatedGames as Game[]).find((g) => g.id === selectedGame)
      if (game && game.managed) {
        const list = await (window as any).electron.getMods(selectedGame)
        setMods(list)
        // Refresh health check immediately after managing
        await checkHealth(selectedGame)
        toast.update(toastId, { render: t.gameManaged, type: 'success', isLoading: false, autoClose: 3000 })
      } else {
        toast.dismiss(toastId)
      }
    } catch (e) {
      console.error(e)
      toast.update(toastId, { render: 'Setup failed', type: 'error', isLoading: false, autoClose: 5000 })
    } finally {
      cleanup()
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
      <DragDropOverlay dragOver={dragOver} />

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
      <Sidebar
        isSidebarCollapsed={isSidebarCollapsed}
        setIsSidebarCollapsed={setIsSidebarCollapsed}
        view={view}
        setView={setView}
        games={games}
        selectedGame={selectedGame}
        setSelectedGame={setSelectedGame}
        currentGame={currentGame}
        t={t}
        setShowExportModal={setShowExportModal}
        handlePickModpack={handlePickModpack}
      />

      {/* Main Content */}
      <main className="flex-1 glass-panel rounded-2xl overflow-hidden flex flex-col relative z-0 god-transition">
        {view === 'settings' ? (
          <SettingsView
            settings={settings}
            handleSaveSettings={handleSaveSettings}
            t={t}
            refreshGames={refreshGames}
            addToast={addToast}
            appVersion={appVersion}
            handleUpdateCheck={handleUpdateCheck}
          />
        ) : currentGame ? (
          <GameLibrary
            currentGame={currentGame}
            mods={mods}
            isManaging={isManaging}
            gameHealth={gameHealth}
            t={t}
            handleManageGame={handleManageGame}
            handleUnmanageGame={handleUnmanageGame}
            handleDisableAll={handleDisableAll}
            handleInstallMod={handleInstallMod}
            setDetailMod={setDetailMod}
            handleCheckUpdate={handleCheckUpdate}
            handleToggleMod={handleToggleMod}
            handleDeleteMod={handleDeleteMod}
            showSourcesMenu={showSourcesMenu}
            setShowSourcesMenu={setShowSourcesMenu}
            readOnly={isTutorialActive}
          />
        ) : (
          <NoGameSelected />
        )}
      </main>

      {showExportModal && (
        <ExportModpackModal
          modpackMeta={modpackMeta}
          setModpackMeta={setModpackMeta}
          handleExportModpack={handleExportModpack}
          setShowExportModal={setShowExportModal}
          t={t}
        />
      )}

      {previewModpack && (
        <PreviewModpackModal
          previewModpack={previewModpack}
          setPreviewModpack={setPreviewModpack}
          handleInstallModpackConfirm={handleInstallModpackConfirm}
          isManaging={isManaging}
          t={t}
          games={games}
        />
      )}

      {installPreview && (
        <InstallPreviewModal
          installPreview={installPreview}
          setInstallPreview={setInstallPreview}
          confirmModInstall={confirmModInstall}
          isManaging={isManaging}
          settings={settings}
          t={t}
        />
      )}

      {redirectInfo && (
        <RedirectModal
          redirectInfo={redirectInfo}
          setRedirectInfo={setRedirectInfo}
          handleSwitchGame={handleSwitchGame}
          handleInstallHere={handleInstallHere}
          t={t}
        />
      )}

      <AdminPermissionModal
        isOpen={showAdminModal}
        onClose={() => setShowAdminModal(false)}
        t={t}
        onRestartAsAdmin={async (remember) => {
          if (remember) {
            await handleSaveSettings({ ...settings, alwaysRunAsAdmin: true })
          }
          window.electron.restartAsAdmin()
          setShowAdminModal(false)
        }}
        onContinue={async (remember) => {
          if (remember) {
            await handleSaveSettings({ ...settings, suppressAdminWarning: true })
          }
          setShowAdminModal(false)
        }}
      />

      {detailMod && currentGame && (
        <ModDetailModal
          detailMod={detailMod}
          setDetailMod={setDetailMod}
          handleUninstallDetailMod={handleUninstallDetailMod}
          handleToggleDetailMod={handleToggleDetailMod}
          currentGame={currentGame}
          t={t}
        />
      )}

      {isTutorialActive && (
        <TutorialWizard
          currentStep={tutorialStep}
          setCurrentStep={setTutorialStep}
          onComplete={handleTutorialComplete}
          onSkip={() => handleTutorialComplete({})}
          onApiKeySubmit={handleTutorialApiKey}
          tutorialMods={tutorialMods}
        />
      )}
    </div>
  )
}

export default App
