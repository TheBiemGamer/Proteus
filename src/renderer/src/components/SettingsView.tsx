import React, { useState } from 'react'
import { ExtensionManager } from './ExtensionManager'
import { IAppSettings } from '../../../shared/types'

interface SettingsViewProps {
  settings: IAppSettings
  handleSaveSettings: (settings: IAppSettings) => Promise<void>
  t: any
  refreshGames: () => Promise<void>
  addToast: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void
  appVersion: string
  handleUpdateCheck: () => Promise<void>
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  handleSaveSettings,
  t,
  refreshGames,
  addToast,
  appVersion,
  handleUpdateCheck
}) => {
  const [settingsTab, setSettingsTab] = useState<'general' | 'extensions' | 'about'>('general')

  return (
    <div className="flex-1 p-8 overflow-y-auto">
      <h2 className="text-3xl font-bold text-white mb-8">{t.settings}</h2>

      <div className="flex space-x-6 border-b border-white/10 mb-8">
        <button
          onClick={() => setSettingsTab('general')}
          className={`pb-4 px-2 font-medium god-transition relative ${
            settingsTab === 'general'
              ? 'text-[rgb(var(--theme-accent))]'
              : 'text-[rgb(var(--theme-text-muted))] hover:text-white'
          }`}
        >
          {t.general}
          {settingsTab === 'general' && (
            <div className="absolute bottom-0 left-0 w-full h-0.5 bg-[rgb(var(--theme-accent))] rounded-t-full shadow-[0_0_10px_rgb(var(--theme-accent))] god-transition animate-in fade-in duration-300" />
          )}
        </button>
        <button
          onClick={() => setSettingsTab('extensions')}
          className={`pb-4 px-2 font-medium god-transition relative ${
            settingsTab === 'extensions'
              ? 'text-[rgb(var(--theme-accent))]'
              : 'text-[rgb(var(--theme-text-muted))] hover:text-white'
          }`}
        >
          {t.extensions}
          {settingsTab === 'extensions' && (
            <div className="absolute bottom-0 left-0 w-full h-0.5 bg-[rgb(var(--theme-accent))] rounded-t-full shadow-[0_0_10px_rgb(var(--theme-accent))] god-transition animate-in fade-in duration-300" />
          )}
        </button>
        <button
          onClick={() => setSettingsTab('about')}
          className={`pb-4 px-2 font-medium god-transition relative ${
            settingsTab === 'about'
              ? 'text-[rgb(var(--theme-accent))]'
              : 'text-[rgb(var(--theme-text-muted))] hover:text-white'
          }`}
        >
          {t.about}
          {settingsTab === 'about' && (
            <div className="absolute bottom-0 left-0 w-full h-0.5 bg-[rgb(var(--theme-accent))] rounded-t-full shadow-[0_0_10px_rgb(var(--theme-accent))] god-transition animate-in fade-in duration-300" />
          )}
        </button>
      </div>

      {settingsTab === 'general' && (
        <div className="max-w-2xl space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500 god-transition">
          {/* General Section */}
          <div className="space-y-4">
            <h3 className="text-xl font-semibold text-gray-300 border-b border-white/10 pb-2">
              {t.general}
            </h3>

            <div className="flex flex-col space-y-2">
              <label className="text-sm font-medium text-gray-400">{t.language}</label>
              <select
                value={settings.language}
                onChange={(e) =>
                  handleSaveSettings({ ...settings, language: e.target.value as any })
                }
                className="glass-input rounded-xl p-2.5 text-white"
              >
                <option value="en" className="bg-gray-900">
                  English
                </option>
                <option value="nl" className="bg-gray-900">
                  Nederlands
                </option>
              </select>
            </div>

            <div className="flex items-center justify-between p-4 glass-panel rounded-xl border border-white/5 god-transition hover:border-white/10">
              <div>
                <h4 className="font-medium text-white">{t.developerMode}</h4>
                <p className="text-sm text-gray-500">{t.developerModeDesc}</p>
              </div>
              <button
                onClick={() =>
                  handleSaveSettings({ ...settings, developerMode: !settings.developerMode })
                }
                className={`w-12 h-6 rounded-full p-1 god-transition ${settings.developerMode ? 'bg-[rgb(var(--theme-accent))]' : 'bg-white/10'}`}
              >
                <div
                  className={`w-4 h-4 bg-white rounded-full god-transition ${settings.developerMode ? 'translate-x-6' : 'translate-x-0'}`}
                />
              </button>
            </div>
          </div>

          {/* Integrations Section */}
          <div className="space-y-4">
            <h3 className="text-xl font-semibold text-gray-300 border-b border-white/10 pb-2">
              {t.integrations}
            </h3>

            <div className="flex flex-col space-y-2">
              <label className="text-sm font-medium text-gray-400">{t.nexusApiKey}</label>
              <input
                type="password"
                value={settings.nexusApiKey}
                onChange={(e) => handleSaveSettings({ ...settings, nexusApiKey: e.target.value })}
                className="glass-input rounded-xl p-2.5 text-white"
                placeholder="API Key..."
              />
              <p className="text-xs text-gray-500">{t.nexusApiKeyDesc}</p>
            </div>
          </div>
        </div>
      )}

      {settingsTab === 'extensions' && (
        <div className="max-w-4xl">
          <ExtensionManager t={t} onChange={refreshGames} showToast={addToast} />
        </div>
      )}

      {settingsTab === 'about' && (
        <div className="max-w-2xl space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500 god-transition">
          <div className="glass-panel border border-white/10 rounded-2xl p-8 text-center space-y-4">
            <h3 className="text-3xl font-black bg-gradient-to-r from-[rgb(var(--theme-accent))] to-purple-500 bg-clip-text text-transparent">
              Proteus Mod Manager
            </h3>
            <p className="text-gray-400">{t.aboutDesc}</p>
            <div className="flex justify-center space-x-4 text-sm text-gray-500 pt-4">
              <div>
                <span className="font-semibold text-gray-400">{t.versionLabel}</span>
                <p>{appVersion}</p>
              </div>
              <div>
                <span className="font-semibold text-gray-400">{t.author}</span>
                <p>TheBiemGamer</p>
              </div>
              <div>
                <span className="font-semibold text-gray-400">License</span>
                <p>MIT</p>
              </div>
            </div>
            <div className="pt-6">
              <button
                onClick={handleUpdateCheck}
                className="px-6 py-2 bg-white/5 hover:bg-white/10 text-white rounded-xl font-medium god-transition border border-white/5 hover:border-white/10"
              >
                {t.checkUpdate}
              </button>
            </div>
          </div>

          <div className="glass-panel border border-white/10 rounded-2xl p-6">
            <h4 className="font-semibold text-white mb-4">License</h4>
            <div className="bg-black/20 rounded-xl p-4 border border-white/5 custom-scrollbar">
              <div className="text-xs text-gray-400 font-mono space-y-2 max-h-48 overflow-y-auto pr-2">
                <p>MIT License</p>
                <p>Copyright (c) 2026 TheBiemGamer</p>
                <p>
                  Permission is hereby granted, free of charge, to any person obtaining a copy of
                  this software and associated documentation files (the &quot;Software&quot;), to
                  deal in the Software without restriction, including without limitation the rights
                  to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies
                  of the Software, and to permit persons to whom the Software is furnished to do so,
                  subject to the following conditions:
                </p>
                <p>
                  The above copyright notice and this permission notice shall be included in all
                  copies or substantial portions of the Software.
                </p>
                <p>
                  THE SOFTWARE IS PROVIDED &quot;AS IS&quot;, WITHOUT WARRANTY OF ANY KIND, EXPRESS
                  OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
                  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
                  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
                  WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
                  CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
