import React from 'react'
import { ChevronRight, ChevronLeft, Wrench, Archive, PackageOpen, Settings } from 'lucide-react'
import { Game } from '../types'

interface SidebarProps {
  isSidebarCollapsed: boolean
  setIsSidebarCollapsed: (collapsed: boolean) => void
  view: string
  setView: (view: 'library' | 'settings') => void
  games: Game[]
  selectedGame: string | null
  setSelectedGame: (id: string) => void
  currentGame: Game | undefined
  t: any
  setShowExportModal: (show: boolean) => void
  handlePickModpack: () => void
}

export const Sidebar: React.FC<SidebarProps> = ({
  isSidebarCollapsed,
  setIsSidebarCollapsed,
  view,
  setView,
  games,
  selectedGame,
  setSelectedGame,
  currentGame,
  t,
  setShowExportModal,
  handlePickModpack
}) => {
  return (
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
  )
}
