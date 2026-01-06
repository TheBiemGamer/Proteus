import { useState, useEffect } from 'react'
import { Plus, Trash2, Power, FileOutput, Check, Package, X } from 'lucide-react'

interface Extension {
  id: string
  name: string
  version: string
  author?: string
  enabled: boolean
}

export function ExtensionManager({
  t,
  onChange,
  showToast
}: {
  t: any
  onChange?: () => void
  showToast: (msg: string, type: any) => void
}) {
  const [extensions, setExtensions] = useState<Extension[]>([])
  const [selectedExtensions, setSelectedExtensions] = useState<Set<string>>(new Set())
  const [importPreview, setImportPreview] = useState<{ filePath: string; preview: any[] } | null>(
    null
  )
  const [importSelection, setImportSelection] = useState<Set<string>>(new Set())

  useEffect(() => {
    loadExtensions()
  }, [])

  const loadExtensions = async () => {
    const list = await (window as any).electron.getExtensionList()
    setExtensions(list)
  }

  const handleToggle = async (id: string, enabled: boolean) => {
    await (window as any).electron.toggleExtension(id, enabled)
    loadExtensions()
    onChange?.()
    showToast(enabled ? t.extensionEnabled : t.extensionDisabled, 'info')
  }

  const handleDelete = async (id: string, name: string) => {
    if (confirm(`Delete extension "${name}"?`)) {
      await (window as any).electron.deleteExtension(id)
      loadExtensions()
      onChange?.()
      showToast(t.extensionDeleted, 'success')
    }
  }

  const handleExportSelected = async () => {
    if (selectedExtensions.size === 0) return
    const ids = Array.from(selectedExtensions)
    await (window as any).electron.exportExtensions(ids)
    setSelectedExtensions(new Set())
    showToast(t.extensionsExported, 'success')
  }

  const handleInstallClick = async () => {
    const result = await (window as any).electron.installExtensionDialog()
    if (!result.canceled && result.preview) {
      setImportPreview({ filePath: result.filePath, preview: result.preview })
      // Default select all
      setImportSelection(new Set(result.preview.map((p: any) => p.path)))
    }
  }

  const handleConfirmImport = async () => {
    if (!importPreview) return
    const selected = Array.from(importSelection)
    if (selected.length === 0) return

    await (window as any).electron.installExtensionsConfirm(importPreview.filePath, selected)
    setImportPreview(null)
    loadExtensions()
    onChange?.()
    showToast(t.extensionsInstalled, 'success')
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="glass-panel p-6 rounded-2xl border border-white/10 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
           <h3 className="text-2xl font-bold text-white flex items-center gap-3">
            <Package className="w-6 h-6 text-[rgb(var(--theme-accent))]" />
            {t.extensions}
           </h3>
           <p className="text-gray-400 text-sm mt-1">Manage plugins and game support modules.</p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={handleExportSelected}
            disabled={selectedExtensions.size === 0}
            className={`px-4 py-2 text-sm font-semibold rounded-xl god-transition flex items-center space-x-2 ${
              selectedExtensions.size > 0
                ? 'bg-purple-500/20 text-purple-200 hover:bg-purple-500/30 border border-purple-500/30'
                : 'bg-white/5 text-gray-500 cursor-not-allowed border border-white/5'
            }`}
          >
            <FileOutput className="w-4 h-4" />
            <span>
              {t.export} ({selectedExtensions.size})
            </span>
          </button>

          <button
            onClick={handleInstallClick}
            className="px-4 py-2 text-sm font-semibold bg-[rgb(var(--theme-accent))] text-white hover:bg-[rgb(var(--theme-accent))]/80 rounded-xl god-transition flex items-center space-x-2 shadow-lg shadow-[rgb(var(--theme-accent))]/20"
          >
            <Plus className="w-4 h-4" />
            <span>{t.addExtension}</span>
          </button>
        </div>
      </div>

      <div className="glass-panel rounded-2xl border border-white/10 overflow-hidden backdrop-blur-md">
        {extensions.length === 0 ? (
          <div className="p-12 text-center text-gray-500 flex flex-col items-center gap-4">
             <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center">
                <Package className="w-8 h-8 text-gray-600" />
             </div>
             <p>{t.noExtensions}</p>
          </div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-black/20 text-gray-400 border-b border-white/5">
                <th className="p-4 w-10 text-center">
                  <div
                    className={`w-5 h-5 rounded-lg border-2 cursor-pointer god-transition flex items-center justify-center mx-auto ${
                      selectedExtensions.size === extensions.length && extensions.length > 0
                        ? 'bg-[rgb(var(--theme-accent))] border-[rgb(var(--theme-accent))]'
                        : 'border-white/20 bg-black/20 hover:border-white/40'
                    }`}
                    onClick={() => {
                      if (selectedExtensions.size === extensions.length)
                        setSelectedExtensions(new Set())
                      else setSelectedExtensions(new Set(extensions.map((e) => e.id)))
                    }}
                  >
                    {selectedExtensions.size === extensions.length && extensions.length > 0 && (
                      <Check className="w-3.5 h-3.5 text-white" />
                    )}
                  </div>
                </th>
                <th className="p-4 font-semibold">{t.modpackTitle}</th>
                <th className="p-4 w-32 font-semibold">Author</th>
                <th className="p-4 w-24 font-semibold">Version</th>
                <th className="p-4 w-32 font-semibold">Status</th>
                <th className="p-4 w-24 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {extensions.map((ext) => (
                <tr
                  key={ext.id}
                  className={`group god-transition hover:bg-white/5 ${!ext.enabled ? 'opacity-60 grayscale hover:opacity-100 hover:grayscale-0' : ''}`}
                >
                  <td className="p-4 text-center">
                    <div
                      className={`w-5 h-5 rounded-lg border-2 cursor-pointer god-transition flex items-center justify-center mx-auto ${
                        selectedExtensions.has(ext.id)
                          ? 'bg-[rgb(var(--theme-accent))] border-[rgb(var(--theme-accent))]'
                          : 'border-white/20 bg-black/20 group-hover:border-white/40'
                      }`}
                      onClick={() => {
                        const newSet = new Set(selectedExtensions)
                        if (newSet.has(ext.id)) newSet.delete(ext.id)
                        else newSet.add(ext.id)
                        setSelectedExtensions(newSet)
                      }}
                    >
                      {selectedExtensions.has(ext.id) && <Check className="w-3.5 h-3.5 text-white" />}
                    </div>
                  </td>
                  <td className="p-4 font-medium text-gray-200">{ext.name}</td>
                  <td className="p-4 text-gray-400 text-sm">{ext.author || 'Unknown'}</td>
                  <td className="p-4 text-gray-500 font-mono text-xs opacity-70">{ext.version || '1.0.0'}</td>
                  <td className="p-4">
                    <span
                      className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold tracking-wide ${
                        ext.enabled
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full mr-2 ${ext.enabled ? 'bg-emerald-400' : 'bg-rose-400'}`}></span>
                      {ext.enabled ? t.enabled : t.disabled}
                    </span>
                  </td>
                  <td className="p-4 flex items-center justify-end space-x-2">
                    <button
                      onClick={() => handleToggle(ext.id, !ext.enabled)}
                      className={`p-2 rounded-xl god-transition border border-transparent ${ext.enabled ? 'text-gray-400 hover:text-white hover:bg-white/10' : 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20 hover:bg-emerald-500/20'}`}
                      title={ext.enabled ? t.disable : t.enable}
                    >
                      <Power className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(ext.id, ext.name)}
                      className="p-2 text-gray-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl god-transition hover:border-rose-500/20 border border-transparent"
                      title={t.delete}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Import Preview Modal */}
      {importPreview && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-8 god-transition animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) setImportPreview(null)
          }}
        >
          <div className="glass-panel border border-white/10 rounded-2xl w-full max-w-lg shadow-2xl flex flex-col max-h-[80vh] god-transition animate-in zoom-in-95 duration-300">
            <div className="p-6 border-b border-white/10 flex justify-between items-center bg-white/5">
              <div>
                <h3 className="text-xl font-bold text-white">Select Extensions</h3>
                <p className="text-gray-400 text-sm mt-0.5">
                   Choose components to install.
                </p>
              </div>
              <button onClick={() => setImportPreview(null)} className="text-gray-500 hover:text-white god-transition">
                 <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto flex-1 custom-scrollbar">
              <div className="space-y-2">
                {importPreview.preview.map((item: any) => (
                  <div
                    key={item.path}
                    className={`flex items-center p-3 rounded-xl border cursor-pointer god-transition ${importSelection.has(item.path) ? 'bg-[rgb(var(--theme-accent))]/10 border-[rgb(var(--theme-accent))]/30' : 'bg-black/20 border-white/5 hover:border-white/10'}`}
                    onClick={() => {
                      const newSet = new Set(importSelection)
                      if (newSet.has(item.path)) newSet.delete(item.path)
                      else newSet.add(item.path)
                      setImportSelection(newSet)
                    }}
                  >
                    <div
                      className={`w-5 h-5 rounded-md border-2 mr-3 flex items-center justify-center god-transition ${importSelection.has(item.path) ? 'bg-[rgb(var(--theme-accent))] border-[rgb(var(--theme-accent))]' : 'border-gray-600 bg-transparent'}`}
                    >
                      {importSelection.has(item.path) && <Check className="w-3.5 h-3.5 text-white" />}
                    </div>
                    <div className="flex-1">
                      <div className={`font-medium ${importSelection.has(item.path) ? 'text-white' : 'text-gray-300'}`}>{item.name}</div>
                      <div className="text-xs text-gray-500 font-mono mt-0.5">{item.path}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="p-6 border-t border-white/10 bg-black/20 flex justify-end space-x-3 rounded-b-2xl">
              <button
                onClick={() => setImportPreview(null)}
                className="px-6 py-2.5 text-sm font-medium text-gray-400 hover:text-white god-transition"
              >
                {t.cancel}
              </button>
              <button
                onClick={handleConfirmImport}
                disabled={importSelection.size === 0}
                className="px-6 py-2.5 bg-[rgb(var(--theme-accent))] hover:bg-[rgb(var(--theme-accent))]/80 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl shadow-lg shadow-[rgb(var(--theme-accent))]/20 font-semibold god-transition text-sm"
              >
                Install Selected ({importSelection.size})
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
