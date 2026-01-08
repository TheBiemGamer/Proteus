import React, { useState } from 'react'
import { Transition } from '@headlessui/react'
import { Check, ArrowRight, Shield, ShieldAlert, FileSymlink, PackageOpen } from 'lucide-react'
import { IAppSettings } from '../../../shared/types'
import { Mod } from '../types'
// @ts-ignore
import nexusIcon from '../assets/Nexus-Icon.png'

interface TutorialWizardProps {
  onComplete: (settings: Partial<IAppSettings>) => void
  onSkip?: () => void
  currentStep: number
  setCurrentStep: (step: number) => void
  onApiKeySubmit: (key: string) => Promise<void>
  tutorialMods?: Mod[]
}

export const TutorialWizard: React.FC<TutorialWizardProps> = ({
  onComplete,
  onSkip,
  currentStep,
  setCurrentStep,
  onApiKeySubmit,
  tutorialMods
}) => {
  const [deployment, setDeployment] = useState<'symlink' | 'hardlink' | 'copy'>('symlink')
  const [admin, setAdmin] = useState(true)
  const [apiKey, setApiKey] = useState('')
  const [loadingKey, setLoadingKey] = useState(false)

  const previewMod = tutorialMods?.find((m) => m.nexusId === '1108')

  // Tutorial Steps:
  // 0: Welcome
  // 1: Nexus Integration (API Key)
  // 2: Sidebar / Game List
  // 3: Install Preview Modal (Real-ish)
  // 4: Mod List
  // 5: Setup (Deployment & Admin)

  const handleApiKey = async () => {
    if (!apiKey.trim()) return
    setLoadingKey(true)
    await onApiKeySubmit(apiKey)
    setLoadingKey(false)
    setCurrentStep(2)
  }

  const handleFinish = () => {
    onComplete({
      deploymentMethod: deployment,
      alwaysRunAsAdmin: admin,
      tutorialCompleted: true
    })
  }

  return (
    <div className="fixed inset-0 z-50 pointer-events-none flex flex-col justify-center items-center font-sans">
      {/* Backdrop for explicit modal steps */}
      <Transition
        as="div"
        show={[0, 1, 3, 5].includes(currentStep)}
        enter="transition-opacity duration-300"
        enterFrom="opacity-0"
        enterTo="opacity-100"
        leave="transition-opacity duration-300"
        leaveFrom="opacity-100"
        leaveTo="opacity-0"
        className={`absolute inset-0 pointer-events-auto ${currentStep === 3 ? 'bg-black/80 backdrop-blur-sm' : 'bg-black/80'}`}
      />

      {/* CONTENT */}
      {/* CONTENT */}
      {/* Container for Steps 0 (Welcome) and 1 (Nexus API) so they overlap and don't shift layout */}
      <div
        className={`pointer-events-auto w-full max-w-2xl px-4 relative flex justify-center items-center transition-all duration-300 ${currentStep <= 1 ? 'min-h-[400px]' : 'h-0 min-h-0'}`}
      >
        {/* STEP 0: WELCOME */}
        <Transition
          as="div"
          show={currentStep === 0}
          enter="transition-all duration-500 transform ease-out"
          enterFrom="opacity-0 translate-y-8 scale-95"
          enterTo="opacity-100 translate-y-0 scale-100"
          leave="transition-all duration-300 transform ease-in"
          leaveFrom="opacity-100 translate-y-0 scale-100"
          leaveTo="opacity-0 -translate-y-8 scale-95"
          className="absolute bg-gray-900 border border-gray-700 p-8 rounded-2xl shadow-2xl z-50 text-center space-y-6 w-full"
        >
          <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400">
            Welcome to Proteus
          </h1>
          <p className="text-gray-300 text-lg">
            Your new modular mod manager. Let's get you set up with Nexus Mods integration for the
            best experience.
          </p>
          <div className="pt-4 flex justify-center gap-4">
            <button
              onClick={onSkip}
              className="px-6 py-2 rounded-lg text-gray-400 hover:text-white transition-colors"
            >
              Skip Tutorial
            </button>
            <button
              onClick={() => setCurrentStep(1)}
              className="px-8 py-3 bg-blue-600 hover:bg-blue-500 rounded-xl font-bold text-white shadow-lg hover:shadow-blue-500/20 transition-all flex items-center gap-2"
            >
              Get Started <ArrowRight size={20} />
            </button>
          </div>
        </Transition>

        {/* STEP 1: NEXUS API KEY */}
        <Transition
          as="div"
          show={currentStep === 1}
          enter="transition-all duration-500 transform ease-out delay-100"
          enterFrom="opacity-0 translate-y-8 scale-95"
          enterTo="opacity-100 translate-y-0 scale-100"
          leave="transition-all duration-300 transform ease-in"
          leaveFrom="opacity-100 translate-y-0 scale-100"
          leaveTo="opacity-0 -translate-y-8 scale-95"
          className="absolute bg-gray-900 border border-gray-700 p-8 rounded-2xl shadow-2xl z-50 text-center space-y-6 w-full"
        >
          <div className="flex flex-col items-center">
            <div className="bg-orange-500/10 p-4 rounded-full mb-4">
              <img
                src={nexusIcon}
                className="w-12 h-12"
                alt="Nexus"
                style={{ filter: 'invert(0)' }}
              />
            </div>
            <h3 className="text-2xl font-bold text-white">Connect Nexus Mods</h3>
          </div>

          <div className="text-left text-sm space-y-4">
            <div className="bg-gray-800 p-4 rounded-lg space-y-2">
              <p className="text-gray-300">1. Log in to Nexus Mods and copy your API Key:</p>
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault()
                  ;(window as any).electron.openUrl('https://www.nexusmods.com/settings/api-keys')
                }}
                className="text-blue-400 hover:underline block truncate font-mono bg-black/30 p-2 rounded"
              >
                https://www.nexusmods.com/settings/api-keys
              </a>
            </div>

            <div className="space-y-2">
              <label className="text-gray-300">2. Paste your API Key here:</label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Paste key here..."
                className="w-full bg-black/40 border border-gray-600 rounded-lg p-3 text-white focus:outline-none focus:border-blue-500 font-mono text-sm"
              />
            </div>
          </div>

          <button
            onClick={handleApiKey}
            disabled={loadingKey || !apiKey}
            className={`w-full py-3 rounded-xl font-bold text-white transition-all flex justify-center items-center gap-2 ${loadingKey || !apiKey ? 'bg-gray-700 text-gray-400' : 'bg-blue-600 hover:bg-blue-500 shadow-lg hover:shadow-blue-500/20'}`}
          >
            {loadingKey ? 'Verifying...' : 'Connect & Fetch Metadata'} <ArrowRight size={18} />
          </button>

          <button
            onClick={() => setCurrentStep(2)}
            className="text-sm text-gray-500 hover:text-gray-300 underline"
          >
            Skip (Use Offline Data)
          </button>
        </Transition>
      </div>

      {/* STEP 2: SIDEBAR EXPLANATION */}
      <Transition
        as="div"
        show={currentStep === 2}
        enter="transition-all duration-500 transform"
        enterFrom="opacity-0 -translate-x-10"
        enterTo="opacity-100 translate-x-0"
        leave="transition-opacity duration-300"
        leaveFrom="opacity-100"
        leaveTo="opacity-0"
        className="absolute left-86 top-24 bg-gray-800/90 backdrop-blur border border-blue-500/50 p-6 rounded-xl shadow-xl max-w-md pointer-events-auto"
      >
        <div className="absolute -left-2 top-6 w-4 h-4 bg-gray-800 border-l border-b border-blue-500/50 transform rotate-45"></div>
        <h3 className="text-xl font-bold text-white mb-2">Game Library</h3>
        <p className="text-gray-300 mb-4">
          This sidebar shows all your detected games. We've added
          <span className="text-blue-400 font-bold mx-1">Subnautica</span>
          as a tutorial example.
        </p>
        <button
          onClick={() => setCurrentStep(3)}
          className="w-full py-2 bg-blue-600/20 border border-blue-500/50 hover:bg-blue-600/40 rounded-lg text-blue-100 transition-colors"
        >
          Next: Automatic Metadata
        </button>
      </Transition>

      {/* STEP 3: INSTALL PREVIEW (Real Modal Clone) */}
      <Transition
        as="div"
        show={currentStep === 3}
        enter="transition-all duration-500 transform"
        enterFrom="opacity-0 scale-95"
        enterTo="opacity-100 scale-100"
        leave="transition-all duration-300 transform"
        leaveTo="opacity-0 scale-95"
        className="glass-panel border border-white/10 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col relative z-50 text-left font-sans pointer-events-auto"
      >
        <div className="relative h-40 w-full">
          <div className="absolute inset-0 bg-gradient-to-t from-gray-950 via-gray-900/40 to-transparent z-10" />
          {/* Use the fetched image if available via some global store or props? For now hardcode the expected one or generic if key missing */}
          <img
            src={
              previewMod?.imageUrl ||
              (apiKey
                ? 'https://staticdelivery.nexusmods.com/mods/1155/images/1108/1108-1669460592-1262846995.png'
                : 'https://placehold.co/600x400/1e293b/475569?text=Mod+Cover')
            }
            alt="Mod Cover"
            className="w-full h-full object-cover"
          />
          <div className="absolute bottom-4 left-6 z-20">
            <h2 className="text-3xl font-bold text-white leading-none shadow-black drop-shadow-md">
              {previewMod?.name || "Tobey's BepInEx Pack for Subnautica"}
            </h2>
          </div>
        </div>

        <div className="p-6 flex-1 space-y-4 bg-[#0b1221]">
          <div className="flex flex-wrap gap-2">
            <span className="px-2 py-1 bg-white/5 rounded text-xs text-gray-400 border border-white/10">
              v{previewMod?.version || '5.2.0'}
            </span>
            <span className="px-2 py-1 bg-white/5 rounded text-xs text-blue-400 border border-white/10">
              {previewMod?.author || 'Tobey'}
            </span>
            {apiKey ? (
              <span className="px-2 py-1 bg-orange-900/40 text-orange-400 rounded text-xs border border-orange-700/40">
                NexusMods: 1108
              </span>
            ) : (
              <span className="px-2 py-1 bg-yellow-900/40 text-yellow-400 rounded text-xs border border-yellow-700/40">
                Offline Mode
              </span>
            )}
          </div>
          <p className="text-gray-300 whitespace-pre-wrap leading-relaxed max-h-32 overflow-hidden text-sm">
            {previewMod?.description ||
              (apiKey
                ? 'BepInEx is a plugin framework and mod loader for Unity Mono games. This pack is pre-configured for Subnautica.'
                : 'Mod description unavailable in offline mode.')}
          </p>

          {!apiKey && (
            <div className="bg-yellow-900/20 border border-yellow-700/50 rounded-lg p-3 flex items-center space-x-3 text-yellow-200 text-xs">
              <span>Note: Without an API Key, this data is limited.</span>
            </div>
          )}
        </div>

        <div className="p-6 border-t border-white/10 bg-black/20 flex justify-end space-x-3">
          <button className="px-4 py-2 text-gray-400">Cancel</button>
          <button
            onClick={() => setCurrentStep(4)}
            className="px-6 py-2 bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded font-medium shadow-lg hover:shadow-blue-500/20"
          >
            Install
          </button>
        </div>
      </Transition>

      {/* STEP 4: MOD LIST EXPLANATION */}
      <Transition
        as="div"
        show={currentStep === 4}
        enter="transition-all duration-500 transform"
        enterFrom="opacity-0 translate-y-10"
        enterTo="opacity-100 translate-y-0"
        leave="transition-opacity duration-300"
        leaveTo="opacity-0"
        className="absolute top-32 right-32 bg-gray-800/90 backdrop-blur border border-green-500/50 p-6 rounded-xl shadow-xl max-w-md pointer-events-auto"
      >
        <h3 className="text-xl font-bold text-white mb-2">Mod Management</h3>
        <p className="text-gray-300 mb-4">
          Here is your installed mod list. Notice how we have{' '}
          <span className="text-green-400">Nautilus</span> and{' '}
          <span className="text-green-400">Tobey's BepInEx</span> ready to go.
          {apiKey && (
            <span className="block mt-2 text-blue-300 text-sm">
              Rich metadata makes managing mods easier!
            </span>
          )}
        </p>
        <div className="bg-gray-900/50 p-3 rounded-lg border border-gray-700 mb-4">
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <PackageOpen size={16} />
            <span>Drag & Drop archives to install more!</span>
          </div>
        </div>
        <button
          onClick={() => setCurrentStep(5)}
          className="w-full py-2 bg-green-600/20 border border-green-500/50 hover:bg-green-600/40 rounded-lg text-green-100 transition-colors"
        >
          Next: Final Setup
        </button>
      </Transition>

      {/* STEP 5: SETUP */}
      <Transition
        as="div"
        show={currentStep === 5}
        enter="transition-all duration-500 transform"
        enterFrom="opacity-0 scale-95"
        enterTo="opacity-100 scale-100"
        className="bg-gray-900 border border-gray-700 p-8 rounded-2xl shadow-2xl relative z-50 w-full max-w-3xl pointer-events-auto"
      >
        <h2 className="text-3xl font-bold text-white mb-6">Configuration</h2>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Deployment Method */}
          <div className="space-y-4">
            <h3 className="text-xl font-semibold text-gray-200 flex items-center gap-2">
              <FileSymlink size={20} className="text-blue-400" />
              Deployment Method
            </h3>
            <div className="space-y-3">
              <button
                onClick={() => setDeployment('symlink')}
                className={`w-full p-4 rounded-xl border text-left transition-all ${
                  deployment === 'symlink'
                    ? 'bg-blue-600/20 border-blue-500 ring-1 ring-blue-500'
                    : 'bg-gray-800 border-gray-700 hover:border-gray-600'
                }`}
              >
                <div className="font-bold text-white mb-1">Symlink (Recommended)</div>
                <div className="text-xs text-gray-400">
                  Creates symbolic links. Fast, saves space, minimal issues.
                  <br />
                  <span className="text-yellow-500">Requires Admin or Dev Mode.</span>
                </div>
              </button>

              <button
                onClick={() => setDeployment('hardlink')}
                className={`w-full p-4 rounded-xl border text-left transition-all ${
                  deployment === 'hardlink'
                    ? 'bg-blue-600/20 border-blue-500 ring-1 ring-blue-500'
                    : 'bg-gray-800 border-gray-700 hover:border-gray-600'
                }`}
              >
                <div className="font-bold text-white mb-1">Hardlink</div>
                <div className="text-xs text-gray-400">
                  Works on same drive only. No Admin required. Good fallback.
                </div>
              </button>
            </div>
          </div>

          {/* Admin Rights */}
          <div className="space-y-4">
            <h3 className="text-xl font-semibold text-gray-200 flex items-center gap-2">
              <Shield size={20} className="text-purple-400" />
              Permissions
            </h3>
            <div
              onClick={() => setAdmin(!admin)}
              className={`cursor-pointer p-4 rounded-xl border transition-all ${
                admin
                  ? 'bg-purple-600/20 border-purple-500 ring-1 ring-purple-500'
                  : 'bg-gray-800 border-gray-700 hover:border-gray-600'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-white">Always Run as Administrator</span>
                {admin && <Check className="text-purple-400" size={20} />}
              </div>
              <p className="text-xs text-gray-400">
                Proteus will automatically restart with elevated privileges. Recommended for
                seamless mod deployment.
              </p>
            </div>

            {deployment === 'symlink' && !admin && (
              <div className="flex items-center gap-2 p-3 bg-yellow-900/30 border border-yellow-700/50 rounded-lg text-yellow-200 text-sm">
                <ShieldAlert size={16} />
                Symlinks may invoke admin prompts if this is disabled.
              </div>
            )}
          </div>
        </div>

        <div className="pt-8 flex justify-end">
          <button
            onClick={handleFinish}
            className="px-8 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 rounded-xl font-bold text-white shadow-lg transition-all"
          >
            Finish Setup
          </button>
        </div>
      </Transition>
    </div>
  )
}
