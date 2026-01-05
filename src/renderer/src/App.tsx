import { useEffect, useState } from 'react'

function App(): React.JSX.Element {
  const [games, setGames] = useState<any[]>([])

  useEffect(() => {
    // request loaded plugins
    window.electron.getExtensions().then((data) => {
      setGames(data)
    })
  }, [])

  return (
    <div className="container">
      <h1>My Mod Manager</h1>
      <h2>Loaded Extensions:</h2>
      <ul>
        {games.map((game) => (
          <li key={game.id}>
            <strong>{game.name}</strong> v{game.version} (ID: {game.id})
          </li>
        ))}
      </ul>
    </div>
  )
}

export default App
