import React from 'react'

interface DragDropOverlayProps {
  dragOver: boolean
}

export const DragDropOverlay: React.FC<DragDropOverlayProps> = ({ dragOver }) => {
  if (!dragOver) return null

  return (
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
  )
}
