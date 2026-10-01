import { useCallback, useState } from 'react'
import type { Difficulty } from './game/difficulty'
import type { Match } from './game/match'
import { GameScreen } from './ui/GameScreen'
import { ResultScreen } from './ui/ResultScreen'
import { TopScreen } from './ui/TopScreen'

type Screen =
  | { name: 'top' }
  | { name: 'game'; difficulty: Difficulty; round: number }
  | { name: 'result'; difficulty: Difficulty; round: number; match: Match; hints: number }

export function App() {
  const [screen, setScreen] = useState<Screen>({ name: 'top' })

  const start = useCallback((difficulty: Difficulty, round = 0) => {
    setScreen({ name: 'game', difficulty, round })
    window.scrollTo(0, 0)
  }, [])
  const toTop = useCallback(() => setScreen({ name: 'top' }), [])
  const finish = useCallback((match: Match, hints: number) => {
    setScreen((s) => (s.name === 'game' ? { name: 'result', difficulty: s.difficulty, round: s.round, match, hints } : s))
    window.scrollTo(0, 0)
  }, [])

  switch (screen.name) {
    case 'top':
      return <TopScreen onStart={start} />
    case 'game':
      return <GameScreen key={screen.round} difficulty={screen.difficulty} onFinish={finish} onQuit={toTop} />
    case 'result':
      return (
        <ResultScreen
          difficulty={screen.difficulty}
          match={screen.match}
          hints={screen.hints}
          onRetry={() => start(screen.difficulty, screen.round + 1)}
          onChangeDifficulty={toTop}
        />
      )
  }
}
