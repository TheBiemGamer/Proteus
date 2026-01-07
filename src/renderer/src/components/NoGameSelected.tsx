import React from 'react'
import { Gamepad2 } from 'lucide-react'

export const NoGameSelected: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center h-full text-[rgb(var(--theme-text-muted))] animate-in fade-in zoom-in-95 duration-500 god-transition">
      <div className="mb-6 p-8 glass-panel rounded-full shadow-2xl bg-[rgb(var(--theme-accent))]/5 border border-[rgb(var(--theme-accent))]/20 god-transition hover:scale-110 hover:shadow-[0_0_30px_rgb(var(--theme-accent))]/20">
        <Gamepad2 className="w-20 h-20 text-[rgb(var(--theme-accent))]" />
      </div>
      <p className="text-2xl font-bold mb-2 text-white">Select a Game</p>
      <p className="text-base text-[rgb(var(--theme-text-muted))]">
        Choose a game from the dock to manage mods
      </p>
    </div>
  )
}
