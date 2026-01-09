import React, { useState, useEffect } from 'react'
import { X, Upload, Link as LinkIcon, Check } from 'lucide-react'
import { Mod } from '../../types'

interface ExportModpackModalProps {
  modpackMeta: {
    title: string
    author: string
    version: string
    description: string
    imagePath: string
    imageUrl?: string
    selectedModIds?: string[]
  }
  setModpackMeta: (meta: any) => void
  handleExportModpack: () => void
  setShowExportModal: (show: boolean) => void
  mods: Mod[]
  t: any
}

export const ExportModpackModal: React.FC<ExportModpackModalProps> = ({
  modpackMeta,
  setModpackMeta,
  handleExportModpack,
  setShowExportModal,
  mods,
  t
}) => {
  const [imageMode, setImageMode] = useState<'file' | 'url'>('file')
  const [imageUrlInput, setImageUrlInput] = useState('')
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [isDownloadingImage, setIsDownloadingImage] = useState(false)

  // Filter out loaders and get selectable mods
  const selectableMods = mods.filter((mod) => {
    const type = mod.type?.toLowerCase() || ''
    return type !== 'loader' && type !== 'binaries'
  })

  // Initialize selected mods (enabled mods by default)
  useEffect(() => {
    if (!modpackMeta.selectedModIds) {
      const defaultSelected = selectableMods
        .filter((mod) => mod.enabled)
        .map((mod) => mod.id)
      setModpackMeta({ ...modpackMeta, selectedModIds: defaultSelected })
    }
  }, [])

  // Update image preview when imagePath changes
  useEffect(() => {
    if (modpackMeta.imagePath) {
      setImagePreview(modpackMeta.imagePath)
    }
  }, [modpackMeta.imagePath])

  const handleBrowseImage = async () => {
    const result = await (window as any).electron.browseImage()
    if (result && !result.canceled) {
      setModpackMeta({ ...modpackMeta, imagePath: result.filePath })
      setImagePreview(result.filePath)
    }
  }

  const handleDownloadImage = async () => {
    if (!imageUrlInput.trim()) return
    setIsDownloadingImage(true)
    try {
      const result = await (window as any).electron.downloadImage(imageUrlInput)
      if (result.success) {
        setModpackMeta({ ...modpackMeta, imagePath: result.filePath, imageUrl: imageUrlInput })
        setImagePreview(result.filePath)
      }
    } catch (e) {
      console.error('Failed to download image', e)
    } finally {
      setIsDownloadingImage(false)
    }
  }

  const toggleModSelection = (modId: string) => {
    const selected = modpackMeta.selectedModIds || []
    const newSelected = selected.includes(modId)
      ? selected.filter((id) => id !== modId)
      : [...selected, modId]
    setModpackMeta({ ...modpackMeta, selectedModIds: newSelected })
  }

  const toggleAllMods = () => {
    const selected = modpackMeta.selectedModIds || []
    if (selected.length === selectableMods.length) {
      setModpackMeta({ ...modpackMeta, selectedModIds: [] })
    } else {
      setModpackMeta({ ...modpackMeta, selectedModIds: selectableMods.map((m) => m.id) })
    }
  }

  const selectedCount = modpackMeta.selectedModIds?.length || 0

  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 god-transition animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) setShowExportModal(false)
      }}
    >
      <div
        className="glass-panel rounded-2xl p-6 w-full max-w-3xl shadow-2xl god-transition animate-in zoom-in-95 duration-300 border relative max-h-[90vh] overflow-y-auto"
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

        <div className="space-y-4 grid grid-cols-2 gap-6">
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
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">Modpack Image</label>

              {/* Image Preview */}
              {imagePreview && (
                <div className="mb-3 rounded-xl overflow-hidden border border-white/10">
                  <img
                    src={imagePreview.startsWith('data:') ? imagePreview : `file://${imagePreview}`}
                    alt="Modpack preview"
                    className="w-full h-40 object-cover"
                    onError={() => setImagePreview(null)}
                  />
                </div>
              )}

              {/* Image Mode Tabs */}
              <div className="flex space-x-2 mb-3">
                <button
                  onClick={() => setImageMode('file')}
                  className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    imageMode === 'file'
                      ? 'bg-[rgb(var(--theme-accent))]/20 text-[rgb(var(--theme-accent))] border border-[rgb(var(--theme-accent))]/30'
                      : 'bg-white/5 text-gray-400 hover:bg-white/10'
                  }`}
                >
                  <Upload className="w-4 h-4 inline mr-1" />
                  {t.browseImage}
                </button>
                <button
                  onClick={() => setImageMode('url')}
                  className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    imageMode === 'url'
                      ? 'bg-[rgb(var(--theme-accent))]/20 text-[rgb(var(--theme-accent))] border border-[rgb(var(--theme-accent))]/30'
                      : 'bg-white/5 text-gray-400 hover:bg-white/10'
                  }`}
                >
                  <LinkIcon className="w-4 h-4 inline mr-1" />
                  {t.imageUrl}
                </button>
              </div>

              {/* File Browse Mode */}
              {imageMode === 'file' && (
                <button
                  onClick={handleBrowseImage}
                  className="w-full px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl border border-white/5 font-medium transition-all"
                >
                  {t.browseImage}
                </button>
              )}

              {/* URL Input Mode */}
              {imageMode === 'url' && (
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={imageUrlInput}
                    onChange={(e) => setImageUrlInput(e.target.value)}
                    className="flex-1 glass-input rounded-xl px-4 py-2 text-white focus:border-[rgb(var(--theme-accent))]/50 focus:ring-1 focus:ring-[rgb(var(--theme-accent))]/50 transition-all"
                    placeholder="https://example.com/image.png"
                  />
                  <button
                    onClick={handleDownloadImage}
                    disabled={isDownloadingImage || !imageUrlInput.trim()}
                    className="px-4 py-2 bg-[rgb(var(--theme-accent))] hover:bg-[rgb(var(--theme-accent))]/80 text-white rounded-xl font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isDownloadingImage ? '...' : t.downloadImage}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Mod Selection List */}
        <div className="mt-6">
          <div className="flex justify-between items-center mb-3">
            <label className="text-sm font-medium text-gray-400">
              {t.selectMods} ({selectedCount}/{selectableMods.length})
            </label>
            <button
              onClick={toggleAllMods}
              className="text-xs px-3 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-all"
            >
              {selectedCount === selectableMods.length ? 'Deselect All' : t.allMods}
            </button>
          </div>

          <div className="max-h-64 overflow-y-auto space-y-2 glass-panel rounded-xl p-3 border border-white/5">
            {selectableMods.length === 0 ? (
              <p className="text-center text-gray-500 py-4">No mods available</p>
            ) : (
              selectableMods.map((mod) => {
                const isSelected = modpackMeta.selectedModIds?.includes(mod.id) || false
                return (
                  <div
                    key={mod.id}
                    onClick={() => toggleModSelection(mod.id)}
                    className={`flex items-center space-x-3 p-3 rounded-lg cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-[rgb(var(--theme-accent))]/10 border border-[rgb(var(--theme-accent))]/30'
                        : 'bg-white/5 hover:bg-white/10 border border-transparent'
                    }`}
                  >
                    {/* Checkbox */}
                    <div
                      className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                        isSelected
                          ? 'bg-[rgb(var(--theme-accent))] border-[rgb(var(--theme-accent))]'
                          : 'border-gray-500'
                      }`}
                    >
                      {isSelected && <Check className="w-3 h-3 text-white" />}
                    </div>

                    {/* Mod Icon */}
                    {mod.imageUrl ? (
                      <img
                        src={mod.imageUrl}
                        alt={mod.name}
                        className="w-10 h-10 rounded object-cover"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none'
                        }}
                      />
                    ) : (
                      <div className="w-10 h-10 rounded bg-white/5 flex items-center justify-center text-gray-500 text-xs font-bold">
                        {mod.name.substring(0, 2).toUpperCase()}
                      </div>
                    )}

                    {/* Mod Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-medium truncate">{mod.name}</p>
                      <p className="text-xs text-gray-400 truncate">
                        {mod.version && `v${mod.version}`}
                        {mod.author && ` • ${mod.author}`}
                      </p>
                    </div>

                    {/* Mod Type Badge */}
                    <span className="text-xs px-2 py-1 rounded bg-white/5 text-gray-400">
                      {mod.type || 'Mod'}
                    </span>
                  </div>
                )
              })
            )}
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