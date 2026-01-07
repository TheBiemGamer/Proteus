import React from 'react'

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
      <div className="glass-panel border border-white/10 rounded-2xl p-6 w-full max-w-lg shadow-2xl god-transition animate-in zoom-in-95 duration-300">
        <h3 className="text-2xl font-bold text-white mb-6">{t.exportModpack}</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">{t.modpackTitle}</label>
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
            <label className="block text-sm font-medium text-gray-400 mb-1">{t.description}</label>
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
  )
}
