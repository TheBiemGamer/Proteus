import { useState, useEffect } from 'react'
import './assets/main.css'

interface Game {
  id: string
  name: string
  detected: boolean
  managed: boolean
  path: string
  steamAppId?: string
  nexusSlug?: string
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

  useEffect(() => {
    refreshGames()
  }, [])

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
    if (confirm(`Are you sure you want to delete "${mod.name}"?`)) {
      await (window as any).electron.deleteMod(selectedGame, mod.id)
      loadMods(selectedGame)
    }
  }

  const handleDisableAll = async () => {
    if (!selectedGame) return
    if (confirm('Disable ALL mods for this game?')) {
      await (window as any).electron.disableAllMods(selectedGame)
      loadMods(selectedGame)
    }
  }

  const handleUnmanageGame = async () => {
    if (!selectedGame) return
    const game = games.find((g) => g.id === selectedGame)
    if (!game) return

    const confirmMsg = `Are you sure you want to stop managing "${game.name}"?\n\nThis will:\n1. Disable all currently active mods\n2. Delete all mod files from the staging area\n3. Remove the mod configuration file\n\nThis cannot be undone.`

    if (confirm(confirmMsg)) {
      const updatedGames = await (window as any).electron.unmanageGame(selectedGame)
      setGames(updatedGames)
      setMods([]) // Clear mods view
    }
  }

  const handleInstallExtension = async () => {
    await (window as any).electron.installExtension()
    refreshGames()
  }

  const handleExportExtension = async () => {
    if (!selectedGame) return
    await (window as any).electron.exportExtension(selectedGame)
  }

  const currentGame = games.find((g) => g.id === selectedGame)

  return (
    <div className="flex h-screen bg-gray-950 text-gray-100 font-sans selection:bg-purple-500 selection:text-white">
      {/* Sidebar */}
      <div className="w-72 bg-gray-900 border-r border-gray-800 flex flex-col shadow-2xl z-10">
        <div className="p-6">
          <h1 className="text-2xl font-black bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent tracking-tighter">
            MOD MANAGER
          </h1>
          <p className="text-xs text-gray-500 mt-1 uppercase tracking-widest font-semibold">
            Library
          </p>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 space-y-1">
          {games.map((g) => (
            <button
              key={g.id}
              onClick={() => setSelectedGame(g.id)}
              className={`group w-full flex items-center justify-between p-3 rounded-xl text-left transition-all duration-200 outline-none focus:ring-2 focus:ring-blue-500/50 ${
                selectedGame === g.id
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
            Extensions
          </h3>
          <button
            onClick={handleInstallExtension}
            className="w-full py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-gray-600 rounded-lg text-sm text-gray-300 transition-all flex items-center justify-center space-x-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M12 6v6m0 0v6m0-6h6m-6 0H6"
              />
            </svg>
            <span>Add Extension</span>
          </button>
          {selectedGame && (
            <button
              onClick={handleExportExtension}
              className="w-full py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-gray-600 rounded-lg text-sm text-gray-300 transition-all flex items-center justify-center space-x-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                />
              </svg>
              <span>Export Config</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col bg-gray-950 relative overflow-hidden">
        {/* Background Gradient */}
        <div className="absolute top-0 left-0 w-full h-96 bg-gradient-to-b from-blue-900/10 to-transparent pointer-events-none" />

        {currentGame ? (
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
                      {currentGame.detected ? 'Ready' : 'Missing'}
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
                      <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                        <path d="M12 0C5.373 0 0 5.373 0 12c0 6.627 5.373 12 12 12s12-5.373 12-12C24 5.373 18.627 0 12 0zm0 22c-5.523 0-10-4.477-10-10S6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z" />
                        <path d="M10 16.5l6-4.5-6-4.5v9z" />
                      </svg>
                      <span className="font-semibold">Play on Steam</span>
                    </a>
                  )}

                  {currentGame.managed && (
                    <button
                      onClick={handleInstallMod}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg shadow-lg hover:shadow-blue-500/20 font-semibold transition-all flex items-center space-x-2"
                    >
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M12 4v16m8-8H4"
                        />
                      </svg>
                      <span>Install Mod</span>
                    </button>
                  )}
                  {currentGame.managed && (
                    <button
                      onClick={() => (window as any).electron.openUrl(currentGame.path)}
                      className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg shadow-lg hover:shadow-gray-500/20 font-semibold transition-all flex items-center space-x-2"
                      title="Open Game Folder"
                    >
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z"
                        />
                      </svg>
                    </button>
                  )}
                </div>
              </div>

              {currentGame.managed && (
                <div className="mt-8 flex items-center justify-between">
                  <div className="flex space-x-6 text-sm font-medium text-gray-400">
                    <div className="flex items-center space-x-2">
                      <span className="text-white text-lg">{mods.length}</span>
                      <span>Total</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-emerald-400 text-lg">
                        {mods.filter((m) => m.enabled).length}
                      </span>
                      <span>Active</span>
                    </div>
                  </div>

                  <div className="flex space-x-3">
                    {mods.filter((m) => m.enabled).length > 0 && (
                      <button
                        onClick={handleDisableAll}
                        className="px-3 py-1.5 text-xs font-medium text-rose-300 hover:text-white bg-rose-900/20 hover:bg-rose-600 border border-rose-800 hover:border-rose-500 rounded transition-all"
                      >
                        Disable All
                      </button>
                    )}
                    <button
                      onClick={handleUnmanageGame}
                      className="px-3 py-1.5 text-xs font-medium text-rose-300 hover:text-white bg-rose-900/10 hover:bg-rose-900/80 border border-rose-900/30 hover:border-rose-700/50 rounded transition-all"
                      title="Stop managing this game and remove all mod data"
                    >
                      Unmanage
                    </button>
                  </div>
                </div>
              )}
            </header>

            <div className="flex-1 p-6 overflow-y-auto">
              {!currentGame.managed ? (
                <div className="flex flex-col items-center justify-center h-full text-center space-y-6">
                  <div className="p-4 bg-gray-900 rounded-full border border-gray-800">
                    <svg
                      className="w-12 h-12 text-gray-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="1.5"
                        d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="1.5"
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white mb-2">Initialization Required</h3>
                    <p className="text-gray-400 max-w-sm mx-auto">
                      To start managing mods for this game, we need to create a config file and scan
                      for existing files.
                    </p>
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
                        <svg
                          className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          ></circle>
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          ></path>
                        </svg>
                        Setting up...
                      </div>
                    ) : (
                      'Manage Game'
                    )}
                  </button>
                </div>
              ) : (
                <div className="space-y-3 pb-10">
                  {/* Health Warning Banner */}
                  {!gameHealth.valid && (
                    <div className="bg-yellow-500/10 border border-yellow-500/20 p-4 rounded-xl flex items-start space-x-4 mb-4">
                      <div className="p-2 bg-yellow-500/20 rounded-lg text-yellow-500">
                        <svg
                          className="w-6 h-6"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                          />
                        </svg>
                      </div>
                      <div className="flex-1">
                        <h3 className="font-bold text-yellow-200">Requirement Missing</h3>
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
                            <span>{gameHealth.linkText || 'Download Requirement'}</span>
                            <svg
                              className="w-4 h-4"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="2"
                                d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                              />
                            </svg>
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
                                <svg
                                  className="w-4 h-4"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth="2"
                                    d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                                  />
                                </svg>
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {mods.length === 0 ? (
                    <div className="border-2 border-dashed border-gray-800 rounded-2xl flex flex-col items-center justify-center h-64 text-gray-500">
                      <p className="font-medium">No mods installed</p>
                      <p className="text-sm mt-1">Drag and drop files here or click Install Mod</p>
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
                                <a
                                  href={`https://www.nexusmods.com/${
                                    currentGame?.nexusSlug || 'games'
                                  }/mods/${mod.nexusId}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-gray-600 hover:text-blue-400 transition-colors"
                                >
                                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M12 0C5.373 0 0 5.373 0 12c0 6.627 5.373 12 12 12s12-5.373 12-12C24 5.373 18.627 0 12 0zm1 17h-2v-2h2v2zm0-4h-2V7h2v6z" />
                                  </svg>
                                </a>
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
                            <svg
                              className="w-5 h-5 transition-transform group-hover/btn:scale-110"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="2"
                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                              />
                            </svg>
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-gray-600 bg-gray-950/50">
            <div className="mb-4 p-6 bg-gray-900 rounded-full shadow-2xl">
              <svg
                className="w-16 h-16 text-gray-700"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1"
                  d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1"
                  d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <p className="text-xl font-medium mb-1">Select a game</p>
            <p className="text-sm">Choose a game from the sidebar to manage mods</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default App
