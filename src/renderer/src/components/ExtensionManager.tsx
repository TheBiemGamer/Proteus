import { useState, useEffect } from 'react'
import { Plus, Trash2, Power, FileOutput, Check } from 'lucide-react'

interface Extension {
  id: string
  name: string
  version: string
  enabled: boolean
}

export function ExtensionManager({ t, onChange }: { t: any; onChange?: () => void }) {
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
  }

  const handleDelete = async (id: string, name: string) => {
    if (confirm(`Delete extension "${name}"?`)) {
      await (window as any).electron.deleteExtension(id)
      loadExtensions()
      onChange?.()
    }
  }

  const handleExportSelected = async () => {
    if (selectedExtensions.size === 0) return
    const ids = Array.from(selectedExtensions)
    await (window as any).electron.exportExtensions(ids)
    setSelectedExtensions(new Set())
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
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-semibold text-gray-300">{t.extensions}</h3>
        <div className="flex space-x-2">
          <button
            onClick={handleExportSelected}
            disabled={selectedExtensions.size === 0}
            className={`px-3 py-1.5 text-xs font-medium rounded transition-all flex items-center space-x-2 ${
              selectedExtensions.size > 0
                ? 'bg-purple-600 text-white hover:bg-purple-500'
                : 'bg-gray-800 text-gray-500 cursor-not-allowed'
            }`}
          >
            <FileOutput className="w-4 h-4" />
            <span>
              {t.export} ({selectedExtensions.size})
            </span>
          </button>

          <button
            onClick={handleInstallClick}
            className="px-3 py-1.5 text-xs font-medium bg-blue-600 text-white hover:bg-blue-500 rounded transition-all flex items-center space-x-2"
          >
            <Plus className="w-4 h-4" />
            <span>{t.addExtension}</span>
          </button>
        </div>
      </div>

      <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
        {extensions.length === 0 ? (
          <div className="p-8 text-center text-gray-500">{t.noExtensions}</div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-gray-950 text-gray-400 border-b border-gray-800">
                <th className="p-4 w-10">
                  {/* Header Checkbox */}
                  <div
                    className={`w-4 h-4 rounded border cursor-pointer flex items-center justify-center ${
                      selectedExtensions.size === extensions.length
                        ? 'bg-blue-600 border-blue-600'
                        : 'border-gray-600'
                    }`}
                    onClick={() => {
                      if (selectedExtensions.size === extensions.length)
                        setSelectedExtensions(new Set())
                      else setSelectedExtensions(new Set(extensions.map((e) => e.id)))
                    }}
                  >
                    {selectedExtensions.size === extensions.length && (
                      <Check className="w-3 h-3 text-white" />
                    )}
                  </div>
                </th>
                <th className="p-4">{t.modpackTitle}</th>
                <th className="p-4 w-24">Version</th>
                <th className="p-4 w-24">Status</th>
                <th className="p-4 w-24 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {extensions.map((ext) => (
                <tr
                  key={ext.id}
                  className="border-b border-gray-800/50 last:border-0 hover:bg-gray-800/30"
                >
                  <td className="p-4">
                    <div
                      className={`w-4 h-4 rounded border cursor-pointer flex items-center justify-center ${
                        selectedExtensions.has(ext.id)
                          ? 'bg-blue-600 border-blue-600'
                          : 'border-gray-600'
                      }`}
                      onClick={() => {
                        const newSet = new Set(selectedExtensions)
                        if (newSet.has(ext.id)) newSet.delete(ext.id)
                        else newSet.add(ext.id)
                        setSelectedExtensions(newSet)
                      }}
                    >
                      {selectedExtensions.has(ext.id) && <Check className="w-3 h-3 text-white" />}
                    </div>
                  </td>
                  <td className="p-4 font-medium text-gray-300">{ext.name}</td>
                  <td className="p-4 text-gray-500 font-mono text-xs">{ext.version || '1.0.0'}</td>
                  <td className="p-4">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider ${
                        ext.enabled
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : 'bg-gray-700/50 text-gray-400 border border-gray-600'
                      }`}
                    >
                      {ext.enabled ? t.enabled : t.disabled}
                    </span>
                  </td>
                  <td className="p-4 flex items-center justify-end space-x-2">
                    <button
                      onClick={() => handleToggle(ext.id, !ext.enabled)}
                      className="p-1.5 text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
                      title={ext.enabled ? t.disable : t.enable}
                    >
                      <Power
                        className={`w-4 h-4 ${ext.enabled ? 'text-emerald-400' : 'text-gray-500'}`}
                      />
                    </button>
                    <button
                      onClick={() => handleDelete(ext.id, ext.name)}
                      className="p-1.5 text-gray-400 hover:text-rose-400 bg-gray-800 hover:bg-rose-900/20 rounded-lg transition-colors"
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
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-8">
          <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-lg shadow-2xl flex flex-col max-h-full">
            <div className="p-6 border-b border-gray-800">
              <h3 className="text-xl font-bold text-white">Select Extensions to Install</h3>
              <p className="text-gray-400 text-sm mt-1">
                Select the components you want to install from this package.
              </p>
            </div>
            <div className="p-4 overflow-y-auto flex-1">
              <div className="space-y-2">
                {importPreview.preview.map((item: any) => (
                  <div
                    key={item.path}
                    className={`flex items-center p-3 rounded-lg border cursor-pointer transition-all ${importSelection.has(item.path) ? 'bg-blue-900/20 border-blue-500/50' : 'bg-gray-950 border-gray-800 hover:border-gray-700'}`}
                    onClick={() => {
                      const newSet = new Set(importSelection)
                      if (newSet.has(item.path)) newSet.delete(item.path)
                      else newSet.add(item.path)
                      setImportSelection(newSet)
                    }}
                  >
                    <div
                      className={`w-5 h-5 rounded border mr-3 flex items-center justify-center ${importSelection.has(item.path) ? 'bg-blue-600 border-blue-600' : 'border-gray-600'}`}
                    >
                      {importSelection.has(item.path) && <Check className="w-3 h-3 text-white" />}
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-gray-200">{item.name}</div>
                      <div className="text-xs text-gray-500 font-mono">{item.path}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="p-6 border-t border-gray-800 bg-gray-900 flex justify-end space-x-3">
              <button
                onClick={() => setImportPreview(null)}
                className="px-4 py-2 text-gray-400 hover:text-white"
              >
                {t.cancel}
              </button>
              <button
                onClick={handleConfirmImport}
                disabled={importSelection.size === 0}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-semibold"
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
