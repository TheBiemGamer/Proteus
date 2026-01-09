import React from 'react'
import { X } from 'lucide-react'

interface ExportModpackModalProps {
  modpackMeta: {
    title: string
    author: string
    version: string
    description: string
    imagePath: string
  }
  setModpackMeta: (meta: any) => void
  handleExportModpack: () => void
  setShowExportModal: (show: boolean) => void
  t: any
}

export const ExportModpackModal: React.FC<ExportModpackModalProps> = ({
  modpackMeta,
  setModpackMeta,
  handleExportModpack,
  setShowExportModal,
  t
}) => {
  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 god-transition animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) setShowExportModal(false)
      }}
    >
      <div
        className="glass-panel rounded-2xl p-6 w-full max-w-lg shadow-2xl god-transition animate-in zoom-in-95 duration-300 border relative"
        style={{ borderColor: 'rgba(var(--theme-accent), 0.3)' }}
      >
        <button
          onClick={() => setShowExportModal(false)}
          className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
        >
          <X className="w-6 h-6" />
        </button>

        <h3
          className="text-2xl font-bold mb-6"
          style={{ color: 'rgb(var(--theme-accent))' }}
        >
          {t.exportModpack}
        </h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">{t.modpackTitle}</label>
            <input
              type="text"
              value={modpackMeta.title}
              onChange={(e) => setModpackMeta({ ...modpackMeta, title: e.target.value })}
              className="w-full glass-input rounded-xl px-4 py-2 text-white focus:border-[rgb(var(--theme-accent))]/50 focus:ring-1 focus:ring-[rgb(var(--theme-accent))]/50 transition-all"
              placeholder="My Awesome Modpack"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">{t.author}</label>
            <input
              type="text"
              value={modpackMeta.author}
              onChange={(e) => setModpackMeta({ ...modpackMeta, author: e.target.value })}
              className="w-full glass-input rounded-xl px-4 py-2 text-white focus:border-[rgb(var(--theme-accent))]/50 focus:ring-1 focus:ring-[rgb(var(--theme-accent))]/50 transition-all"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">{t.version}</label>
            <input
              type="text"
              value={modpackMeta.version}
              onChange={(e) => setModpackMeta({ ...modpackMeta, version: e.target.value })}
              className="w-full glass-input rounded-xl px-4 py-2 text-white focus:border-[rgb(var(--theme-accent))]/50 focus:ring-1 focus:ring-[rgb(var(--theme-accent))]/50 transition-all"
              placeholder="1.0.0"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">{t.description}</label>
            <textarea
              value={modpackMeta.description}
              onChange={(e) => setModpackMeta({ ...modpackMeta, description: e.target.value })}
              className="w-full glass-input rounded-xl px-4 py-2 text-white h-24 focus:border-[rgb(var(--theme-accent))]/50 focus:ring-1 focus:ring-[rgb(var(--theme-accent))]/50 transition-all"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">{t.iconPath}</label>
            <div className="flex space-x-2">
              <input
                type="text"
                value={modpackMeta.imagePath}
                onChange={(e) => setModpackMeta({ ...modpackMeta, imagePath: e.target.value })}
                className="flex-1 glass-input rounded-xl px-4 py-2 text-gray-400 focus:border-[rgb(var(--theme-accent))]/50 focus:ring-1 focus:ring-[rgb(var(--theme-accent))]/50 transition-all"
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
            className="px-6 py-2 text-white rounded-xl shadow-lg font-semibold god-transition"
            style={{
              backgroundColor: 'rgb(var(--theme-accent))',
              boxShadow: '0 4px 14px 0 rgba(var(--theme-accent), 0.39)'
            }}
          >
            {t.export}
          </button>
        </div>
      </div>
    </div>
  )
}