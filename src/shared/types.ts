export interface IGameExtension {
  id: string // eg 'skyrim-se'
  name: string // eg 'Skyrim Special Edition'
  author: string // eg 'TheBiemGamer'
  executable: string // eg 'SkyrimSE.exe'
  version: string

  // detect game function
  detect(paths: string[]): Promise<string | null>

  // deploy mod function
  deployMod(modPath: string, gamePath: string): Promise<boolean>
}
