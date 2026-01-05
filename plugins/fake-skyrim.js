// fake extention for testing
module.exports.default = {
  id: 'skyrim-se',
  name: 'Skyrim Special Edition',
  author: 'TheBiemGamer',
  executable: 'SkyrimSE.exe',
  version: '0.1',

  detect: async (paths) => {
    // logic to check if file exists
    console.log('Searching for Skyrim...')
    return 'C:\\Games\\Skyrim' // fake success
  },

  deployMod: async (modPath, gamePath) => {
    console.log(`Deploying ${modPath} to ${gamePath}`)
    return true
  }
}
