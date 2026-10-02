import { useEffect, useState } from 'react'
import { DIFFICULTIES, type Difficulty } from '../game/difficulty'
import { DifficultyPicker } from './DifficultyPicker'
import { Logo } from './marks'
import { RulesList } from './Rules'

export function TopScreen({ onStart }: { onStart: (d: Difficulty) => void }) {
  const [difficulty, setDifficulty] = useState<Difficulty>('normal')

  // ← → で難易度を変え、Enter で始める。ボタンや「遊び方」にフォーカスがあるときはそちらに任せる
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.repeat || e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return
      const onControl = e.target instanceof HTMLButtonElement || (e.target instanceof HTMLElement && e.target.tagName === 'SUMMARY')
      if (e.key === 'Enter' && !onControl) {
        e.preventDefault()
        onStart(difficulty)
      } else if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && !onControl) {
        e.preventDefault()
        if (difficulty === 'max') {
          // 隠しモードの Max は Hard の右隣として扱う(← で Hard に戻る)
          if (e.key === 'ArrowLeft') setDifficulty('hard')
          return
        }
        const i = DIFFICULTIES.indexOf(difficulty) + (e.key === 'ArrowLeft' ? -1 : 1)
        setDifficulty(DIFFICULTIES[Math.max(0, Math.min(DIFFICULTIES.length - 1, i))])
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [difficulty, onStart])

  return (
    <main className="top">
      <header className="top__hero">
        <Logo size="large" />
        <p className="top__lead">
          4つの数字を、相手より
          <wbr />
          少ない回数で当てよう。
        </p>
      </header>

      <section className="top__select" aria-labelledby="select-title">
        <h2 id="select-title" className="section-title">
          相手を選ぶ
        </h2>
        <DifficultyPicker value={difficulty} onChange={setDifficulty} />
        <button type="button" className="button button--primary start-button" onClick={() => onStart(difficulty)} aria-keyshortcuts="Enter">
          START
          <kbd className="kbd">Enter</kbd>
        </button>
      </section>

      <details className="rules" open>
        <summary>遊び方</summary>
        <RulesList />
      </details>
    </main>
  )
}
